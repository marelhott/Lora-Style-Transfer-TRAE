#!/usr/bin/env python3
"""
RunPod Standalone Backend pro LoRA Style Transfer - Clean Version
Optimalizováno pro GPU zpracování s CUDA podporou
"""

import os
import asyncio
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import base64
from pathlib import Path
import stat
import logging

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import torch
import gc
from PIL import Image
import io

# Import AI/ML libraries
try:
    from diffusers import StableDiffusionPipeline, DiffusionPipeline
    from diffusers.utils import load_image
    import transformers
except ImportError:
    print("Warning: Diffusers not installed. Install with: pip install diffusers transformers")

# Import tříd místo instancí pro vyřešení circular imports
from model_manager import ModelManager
from ai_pipeline import AIProcessor

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
app = FastAPI(title="LoRA Style Transfer API - Clean Version", version="2.0.0")
processing_jobs: Dict[str, Dict] = {}
loaded_models: Dict[str, Any] = {}
loaded_loras: Dict[str, Any] = {}

# Globální instance - vytvořené zde pro vyřešení circular imports
model_manager = None
ai_processor = None

# RunPod persistent storage paths
MODELS_PATH = Path("/data/models")
LORAS_PATH = Path("/data/loras")
TEMP_PATH = Path("/tmp/processing")

# Ensure directories exist
TEMP_PATH.mkdir(parents=True, exist_ok=True)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
if Path("/app/.next").exists():
    app.mount("/", StaticFiles(directory="/app/.next", html=True), name="frontend")

# Pydantic models
class ProcessingParameters(BaseModel):
    strength: float = 0.8
    cfgScale: float = 7.5
    steps: int = 20
    clipSkip: int = 1
    seed: Optional[int] = None
    sampler: str = "DPM++ 2M Karras"
    batchCount: int = 1
    upscaleFactor: Optional[int] = None

class ModelInfo(BaseModel):
    id: str
    name: str
    type: str  # "full" or "lora"
    fileSize: int
    uploadedAt: int
    isActive: bool
    metadata: Optional[Dict] = None

class ProcessingJob(BaseModel):
    job_id: str
    status: str
    progress: float
    current_step: Optional[str] = None
    estimated_time_remaining: Optional[float] = None
    error_message: Optional[str] = None
    results: Optional[List[Dict]] = None

# GPU utilities
def get_gpu_info():
    """Získá informace o GPU"""
    if torch.cuda.is_available():
        return {
            "cuda_available": True,
            "device_count": torch.cuda.device_count(),
            "current_device": torch.cuda.current_device(),
            "device_name": torch.cuda.get_device_name(),
            "memory_allocated": torch.cuda.memory_allocated(),
            "memory_reserved": torch.cuda.memory_reserved(),
        }
    return {"cuda_available": False}

def clear_gpu_memory():
    """Vyčistí GPU paměť"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        gc.collect()

# Progress callback pro real-time updates
async def update_job_progress(job_id: str, status: str, step: str, progress: float):
    """Aktualizuje progress jobu"""
    if job_id in processing_jobs:
        processing_jobs[job_id].update({
            "status": status,
            "current_step": step,
            "progress": progress,
            "updated_at": datetime.now().isoformat()
        })

# API endpoints
@app.get("/")
async def root():
    return {"message": "LoRA Style Transfer API - Clean Version", "status": "running", "gpu_info": get_gpu_info()}

@app.get("/api/models")
async def get_models():
    """Vrátí seznam dostupných modelů"""
    try:
        models = model_manager.get_available_models()
        return models
    except Exception as e:
        logger.error(f"Error in get_models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan models: {str(e)}")

@app.get("/api/debug/paths")
async def debug_paths():
    """Debug endpoint pro kontrolu cest a dostupnosti modelů"""
    try:
        import os
        debug_info = {
            "models_path": str(model_manager.models_path),
            "loras_path": str(model_manager.loras_path),
            "models_path_exists": model_manager.models_path.exists(),
            "loras_path_exists": model_manager.loras_path.exists(),
            "temp_path": str(TEMP_PATH),
            "temp_path_exists": TEMP_PATH.exists(),
            "current_working_dir": os.getcwd(),
            "model_metadata_count": len(model_manager.model_metadata),
            "available_models": len(model_manager.get_available_models())
        }

        # Zkus vylistovat obsah adresářů
        if model_manager.models_path.exists():
            try:
                models_files = list(model_manager.models_path.rglob("*.safetensors")) + list(model_manager.models_path.rglob("*.ckpt"))
                debug_info["models_files_found"] = [str(f) for f in models_files[:5]]  # max 5 pro přehlednost
                debug_info["models_files_count"] = len(models_files)
            except Exception as e:
                debug_info["models_scan_error"] = str(e)

        if model_manager.loras_path.exists():
            try:
                loras_files = list(model_manager.loras_path.rglob("*.safetensors"))
                debug_info["loras_files_found"] = [str(f) for f in loras_files[:5]]  # max 5 pro přehlednost
                debug_info["loras_files_count"] = len(loras_files)
            except Exception as e:
                debug_info["loras_scan_error"] = str(e)

        return debug_info
    except Exception as e:
        logger.error(f"Error in debug_paths: {e}")
        raise HTTPException(status_code=500, detail=f"Debug failed: {str(e)}")

@app.get("/api/rescan")
async def rescan_default_paths():
    """Jednoduchý rescan s výchozími cestami"""
    try:
        logger.info("Rescanning models with default paths")
        model_manager.scan_models()
        models = model_manager.get_available_models()

        return {
            "success": True,
            "models_path": str(model_manager.models_path),
            "loras_path": str(model_manager.loras_path),
            "models_found": len(models),
            "models": models
        }
    except Exception as e:
        logger.error(f"Error in rescan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    gpu_info = get_gpu_info()
    performance_stats = ai_processor.get_performance_stats()
    available_models = model_manager.get_available_models()
    
    # Počet modelů podle typu
    full_models = [m for m in available_models if m.get("type") == "full"]
    lora_models = [m for m in available_models if m.get("type") == "lora"]
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "gpu_info": gpu_info,
        "performance_stats": performance_stats,
        "models_count": len(full_models),
        "loras_count": len(lora_models),
        "models_available": len(available_models),
        "active_jobs": len([j for j in processing_jobs.values() if j["status"] in ["pending", "processing"]])
    }

@app.post("/api/process")
async def start_processing(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    model_id: str = Form(...),
    parameters: str = Form(...)
):
    """Spustí zpracování obrázku"""
    try:
        # Parse parameters
        params = ProcessingParameters(**json.loads(parameters))
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Save uploaded image
        image_data = await image.read()
        image_path = TEMP_PATH / f"{job_id}_input.png"
        
        with open(image_path, "wb") as f:
            f.write(image_data)
        
        # Initialize job
        processing_jobs[job_id] = {
            "job_id": job_id,
            "status": "pending",
            "progress": 0.0,
            "current_step": "Initializing...",
            "model_id": model_id,
            "parameters": params.dict(),
            "input_image": str(image_path),
            "created_at": datetime.now().isoformat(),
            "estimated_time_remaining": None,
            "error_message": None,
            "results": None
        }
        
        # Start background processing
        background_tasks.add_task(process_image, job_id)
        
        return {"job_id": job_id, "status": "pending"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start processing: {str(e)}")

@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str):
    """Vrátí status zpracování"""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return processing_jobs[job_id]

# Background processing function
async def process_image(job_id: str):
    """Zpracuje obrázek na pozadí pomocí AI pipeline"""
    job = processing_jobs[job_id]
    
    try:
        # Extrahuj parametry
        model_id = job["model_id"]
        parameters = job["parameters"]
        input_image_path = job["input_image"]
        
        # Zkontroluj jestli je to LoRA model
        model_info = model_manager.get_model_info(model_id)
        if not model_info:
            raise ValueError(f"Model {model_id} not found")
        
        lora_id = None
        actual_model_id = model_id
        
        # Pokud je vybraný model LoRA, najdi základní model
        if model_info['type'] == 'lora':
            lora_id = model_id
            # Najdi první dostupný full model jako základ
            available_models = model_manager.get_available_models()
            base_models = [m for m in available_models if m['type'] == 'full']
            if not base_models:
                raise ValueError("No base Stable Diffusion model found for LoRA")
            actual_model_id = base_models[0]['id']
            logger.info(f"Using LoRA {lora_id} with base model {actual_model_id}")
        
        # Spusť AI zpracování
        results = await ai_processor.process_style_transfer(
            job_id=job_id,
            input_image_path=input_image_path,
            model_id=actual_model_id,
            parameters=parameters,
            lora_id=lora_id,
            lora_weight=parameters.get('lora_weight', 1.0),
            progress_callback=update_job_progress
        )
        
        # Aktualizuj job s výsledky
        job["status"] = "completed"
        job["current_step"] = "Processing completed!"
        job["progress"] = 100.0
        job["results"] = results
        job["completed_at"] = datetime.now().isoformat()
        
        logger.info(f"Job {job_id} completed successfully with {len(results)} results")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job["status"] = "failed"
        job["error_message"] = str(e)
        job["current_step"] = f"Error: {str(e)}"
        job["completed_at"] = datetime.now().isoformat()

def initialize_services():
    """Inicializace služeb po startu aplikace"""
    global model_manager, ai_processor
    model_manager = ModelManager()
    ai_processor = AIProcessor()
    logger.info("Services initialized successfully")

# Inicializace při startu
initialize_services()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
