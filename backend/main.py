#!/usr/bin/env python3
"""
RunPod Backend API pro LoRA Style Transfer
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

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
import logging

logger = logging.getLogger(__name__)

# Global variables
app = FastAPI(title="LoRA Style Transfer API", version="1.0.0")
processing_jobs: Dict[str, Dict] = {}
loaded_models: Dict[str, Any] = {}
loaded_loras: Dict[str, Any] = {}

# Globální instance - vytvořené zde pro vyřešení circular imports
model_manager = None
ai_processor = None

# RunPod persistent storage paths (allow override via env)
MODELS_PATH = Path(os.environ.get("MODELS_PATH", "/data/models"))
LORAS_PATH = Path(os.environ.get("LORAS_PATH", "/data/loras"))
TEMP_PATH = Path("/tmp/processing")

# Ensure directories exist
TEMP_PATH.mkdir(parents=True, exist_ok=True)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Povolit všechny origins pro debugging
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

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
    return {"message": "LoRA Style Transfer API", "status": "running", "gpu_info": get_gpu_info()}

@app.get("/api/models")
async def get_models(debug: int = 0):
    """Vrátí seznam dostupných modelů. Při debug=1 vrací i cesty a počty."""
    try:
        models = model_manager.get_available_models()
        if debug:
            return {
                "models": models,
                "models_path": str(model_manager.models_path),
                "loras_path": str(model_manager.loras_path),
                "models_path_exists": model_manager.models_path.exists(),
                "loras_path_exists": model_manager.loras_path.exists(),
                "models_found": len(models)
            }
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

@app.get("/api/browse-directory")
async def browse_directory(path: str = "/data"):
    """Browse directory contents on the server"""
    try:
        # Security check - only allow browsing within /data
        if not path.startswith("/data"):
            path = "/data"
        
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Directory not found")
        
        if not os.path.isdir(path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        items = []
        try:
            for item_name in sorted(os.listdir(path)):
                item_path = os.path.join(path, item_name)
                
                # Skip hidden files
                if item_name.startswith('.'):
                    continue
                
                try:
                    item_stat = os.stat(item_path)
                    is_dir = os.path.isdir(item_path)
                    
                    # For files, check if it's a model file
                    is_model = False
                    if not is_dir:
                        ext = os.path.splitext(item_name)[1].lower()
                        is_model = ext in ['.safetensors', '.ckpt', '.pt', '.pth', '.bin']
                    
                    items.append({
                        "name": item_name,
                        "path": item_path,
                        "is_directory": is_dir,
                        "is_model": is_model,
                        "size": item_stat.st_size if not is_dir else 0,
                        "modified": item_stat.st_mtime
                    })
                except (OSError, PermissionError):
                    # Skip items we can't access
                    continue
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        return {
            "current_path": path,
            "parent_path": os.path.dirname(path) if path != "/data" else None,
            "items": items
        }
    except HTTPException:
        raise
    except Exception as e:
         logger.error(f"Error browsing directory {path}: {e}")
         raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan-models")
async def scan_models_from_path(request: dict):
    """Scan for models in specified paths"""
    try:
        models_path = request.get('models_path', '/data/models')
        loras_path = request.get('loras_path', '/data/loras')

        # Security check - only allow paths within /data
        if not models_path.startswith('/data'):
            models_path = '/data/models'
        if not loras_path.startswith('/data'):
            loras_path = '/data/loras'

        logger.info(f"Rescanning models: models_path={models_path}, loras_path={loras_path}")

        # Update model manager paths
        model_manager.models_path = Path(models_path)
        model_manager.loras_path = Path(loras_path)

        # Rescan models
        model_manager.scan_models()

        # Get updated models list
        models = model_manager.get_available_models()

        return {
            "success": True,
            "models_path": models_path,
            "loras_path": loras_path,
            "models_found": len(models),
            "models": models,
            "models_path_exists": model_manager.models_path.exists(),
            "loras_path_exists": model_manager.loras_path.exists()
        }
    except Exception as e:
        logger.error(f"Error scanning models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/")
async def root():
    """Root endpoint - simple test"""
    return {"message": "LoRA Style Transfer Backend is running!", "status": "ok"}

@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint"""
    return {"message": "Backend is working!", "models_path": str(MODELS_PATH), "loras_path": str(LORAS_PATH)}

@app.post("/api/scan-disk")
async def scan_disk():
    """Robustní scan persist disku pro modely"""
    try:
        # Vytvoř adresáře pokud neexistují
        MODELS_PATH.mkdir(parents=True, exist_ok=True)
        LORAS_PATH.mkdir(parents=True, exist_ok=True)
        
        # Manuální scan souborů
        models_found = []
        loras_found = []
        
        # Scan full models
        for ext in ["*.safetensors", "*.ckpt", "*.pt", "*.pth"]:
            for model_file in MODELS_PATH.rglob(ext):
                if model_file.is_file():
                    models_found.append({
                        "name": model_file.stem,
                        "path": str(model_file),
                        "size": model_file.stat().st_size,
                        "type": "full"
                    })
        
        # Scan LoRA models
        for ext in ["*.safetensors", "*.pt"]:
            for lora_file in LORAS_PATH.rglob(ext):
                if lora_file.is_file():
                    loras_found.append({
                        "name": lora_file.stem,
                        "path": str(lora_file),
                        "size": lora_file.stat().st_size,
                        "type": "lora"
                    })
        
        # Pokud máme model_manager, použij ho
        if model_manager:
            try:
                model_manager.scan_models()
                managed_models = model_manager.get_available_models()
            except Exception as e:
                logger.error(f"ModelManager scan failed: {e}")
                managed_models = []
        else:
            managed_models = []
        
        return {
            "status": "success",
            "manual_scan": {
                "models_path": str(MODELS_PATH),
                "loras_path": str(LORAS_PATH),
                "models_exists": MODELS_PATH.exists(),
                "loras_exists": LORAS_PATH.exists(),
                "models_count": len(models_found),
                "loras_count": len(loras_found),
                "models": models_found,
                "loras": loras_found
            },
            "managed_scan": {
                "available": model_manager is not None,
                "models": managed_models
            }
        }
        
    except Exception as e:
        logger.error(f"Disk scan failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "models_path": str(MODELS_PATH),
            "loras_path": str(LORAS_PATH)
        }

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

@app.post("/api/upload-model")
async def upload_model(
    file: UploadFile = File(...),
    model_type: str = Form("full")  # "full" nebo "lora"
):
    """Nahraje model na RunPod persistentní disk"""
    try:
        # Kontrola typu souboru
        if not file.filename.lower().endswith(('.safetensors', '.ckpt', '.pt', '.pth')):
            raise HTTPException(status_code=400, detail="Invalid file type. Only .safetensors, .ckpt, .pt, .pth files are allowed")
        
        # Urči cílový adresář podle typu
        if model_type == "lora":
            target_dir = LORAS_PATH
        else:
            target_dir = MODELS_PATH
        
        # Vytvoř adresář pokud neexistuje
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Ulož soubor na RunPod disk
        file_path = target_dir / file.filename
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Rescan modely
        model_manager.scan_models()
        
        return {
            "success": True,
            "filename": file.filename,
            "model_type": model_type,
            "file_path": str(file_path),
            "file_size": len(content),
            "message": f"Model {file.filename} uploaded successfully to {target_dir}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

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
    
    # Vytvoř adresáře pokud neexistují
    MODELS_PATH.mkdir(parents=True, exist_ok=True)
    LORAS_PATH.mkdir(parents=True, exist_ok=True)
    
    # Inicializuj s cestami (z env)
    model_manager = ModelManager(models_path=str(MODELS_PATH), loras_path=str(LORAS_PATH))
    ai_processor = AIProcessor()
    
    # Automaticky naskenuj modely při startu
    logger.info("Scanning models on startup...")
    try:
        model_manager.scan_models()
        logger.info(f"Startup scan: models_path={model_manager.models_path} exists={model_manager.models_path.exists()} | loras_path={model_manager.loras_path} exists={model_manager.loras_path.exists()}")
    except Exception as e:
        logger.error(f"Initial scan failed: {e}")
    
    # Zobraz info o nalezených modelech
    models = model_manager.get_available_models()
    logger.info(f"Found {len(models)} models on startup")
    for model in models:
        logger.info(f"  - {model['name']} ({model['type']})")
    
    logger.info("Services initialized successfully")

# Inicializace při startu - s error handlingem
try:
    initialize_services()
except Exception as e:
    logger.error(f"FATAL: Could not initialize services: {e}")
    logger.error("Backend will run in fallback mode")
    model_manager = None
    ai_processor = None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
