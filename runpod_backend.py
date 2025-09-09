#!/usr/bin/env python3
"""
RunPod Standalone Backend pro LoRA Style Transfer
FastAPI server optimalizovaný pro RunPod deployment
"""

import os
import sys
import json
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

from ai_processor import AIProcessor

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="LoRA Style Transfer API",
    description="AI-powered style transfer using LoRA models",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global AI processor instance
ai_processor = None

# Job storage (in-memory)
jobs_storage: Dict[str, Dict] = {}

# Pydantic models
class ProcessingJob(BaseModel):
    job_id: str
    status: str
    progress: int
    current_step: Optional[str] = None
    results: Optional[List[Dict]] = None
    error_message: Optional[str] = None
    created_at: float
    completed_at: Optional[float] = None

class ModelInfo(BaseModel):
    id: str
    name: str
    type: str
    fileSize: int
    uploadedAt: float
    path: str

@app.on_event("startup")
async def startup_event():
    """Inicializace při startu aplikace"""
    global ai_processor
    
    logger.info("🚀 Starting LoRA Style Transfer RunPod Backend")
    
    # Kontrola prostředí
    data_path = os.getenv("DATA_PATH", "/data")
    logger.info(f"📁 Data path: {data_path}")
    
    # Kontrola GPU
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        logger.info(f"🎮 CUDA available: {cuda_available}")
        if cuda_available:
            gpu_name = torch.cuda.get_device_name()
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"🎮 GPU: {gpu_name} ({gpu_memory:.1f}GB)")
    except Exception as e:
        logger.warning(f"⚠️ GPU check failed: {e}")
    
    # Inicializace AI processoru
    try:
        ai_processor = AIProcessor()
        logger.info("✅ AI Processor initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize AI Processor: {e}")
        raise e

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup při vypnutí"""
    global ai_processor
    
    logger.info("🛑 Shutting down LoRA Style Transfer Backend")
    
    if ai_processor:
        ai_processor.cleanup()
        logger.info("✅ AI Processor cleanup completed")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "LoRA Style Transfer API - Trae AI Version",
        "status": "running",
        "version": "2.0.0-trae",
        "build_date": "2025-01-09",
        "features": [
            "Real progress tracking",
            "Proper error handling", 
            "Model verification",
            "LoRA auto-detection"
        ],
        "gpu_available": torch.cuda.is_available(),
        "branch": "trae-ai-development"
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    global ai_processor
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ai_processor": ai_processor is not None
    }
    
    if ai_processor:
        try:
            stats = ai_processor.get_performance_stats()
            health_status["performance"] = stats
        except Exception as e:
            health_status["performance_error"] = str(e)
    
    return health_status

@app.get("/api/models")
async def get_models():
    """Získá seznam dostupných modelů"""
    global ai_processor
    
    if not ai_processor:
        raise HTTPException(status_code=500, detail="AI Processor not initialized")
    
    try:
        models = ai_processor.get_available_models()
        loras = ai_processor.get_available_loras()
        
        # Převod na frontend formát
        all_models = []
        
        for model in models:
            model_path = Path(model["path"])
            stats = model_path.stat()
            all_models.append({
                "id": model["id"],
                "name": model["name"],
                "type": "full",
                "fileSize": stats.st_size,
                "uploadedAt": stats.st_mtime * 1000,  # Convert to milliseconds
                "path": model["path"]
            })
        
        for lora in loras:
            lora_path = Path(lora["path"])
            stats = lora_path.stat()
            all_models.append({
                "id": lora["id"],
                "name": lora["name"],
                "type": "lora",
                "fileSize": stats.st_size,
                "uploadedAt": stats.st_mtime * 1000,  # Convert to milliseconds
                "path": lora["path"]
            })
        
        return {
            "models": all_models,
            "models_count": len(models),
            "loras_count": len(loras),
            "total_count": len(all_models)
        }
        
    except Exception as e:
        logger.error(f"Error loading models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load models: {str(e)}")

@app.post("/api/scan-disk")
async def scan_disk():
    """Skenuje disk pro nové modely"""
    global ai_processor
    
    if not ai_processor:
        raise HTTPException(status_code=500, detail="AI Processor not initialized")
    
    try:
        models = ai_processor.get_available_models()
        loras = ai_processor.get_available_loras()
        
        return {
            "status": "success",
            "models_count": len(models),
            "loras_count": len(loras),
            "total_count": len(models) + len(loras),
            "models_path": str(ai_processor.models_path),
            "loras_path": str(ai_processor.loras_path)
        }
        
    except Exception as e:
        logger.error(f"Error scanning disk: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

async def process_image_background(job_id: str, image_data: bytes, model_id: str, parameters: Dict):
    """Background task pro zpracování obrázku s reálným progress trackingem"""
    global ai_processor, jobs_storage
    
    def progress_callback(step: str, progress: int):
        """Callback pro update progress v real-time"""
        if job_id in jobs_storage:
            jobs_storage[job_id]["progress"] = progress
            jobs_storage[job_id]["current_step"] = step
            logger.info(f"Job {job_id}: {progress}% - {step}")
    
    try:
        # Inicializace
        jobs_storage[job_id]["status"] = "processing"
        progress_callback("Starting processing...", 0)
        
        # Verifikace AI processoru
        if ai_processor is None:
            raise RuntimeError("AI Processor not initialized")
        
        # Process image s progress callback
        result = await ai_processor.process_image(image_data, model_id, parameters, progress_callback)
        
        # Update job with results
        frontend_result = {
            "id": result["id"],
            "imageUrl": result["image_url"],
            "seed": result["parameters"].get("seed", 0),
            "parameters": {
                "strength": parameters.get("strength", 0.7),
                "cfgScale": parameters.get("cfgScale", 7.5),
                "steps": parameters.get("steps", 20),
                "sampler": parameters.get("sampler", "Euler a")
            },
            "createdAt": int(datetime.now().timestamp() * 1000)
        }
        
        jobs_storage[job_id].update({
            "status": "completed",
            "progress": 100,
            "current_step": "Processing complete",
            "results": [frontend_result],
            "completed_at": datetime.now().timestamp()
        })
        
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        # Detailní error handling s konkrétními důvody
        error_type = type(e).__name__
        error_message = str(e)
        
        # Kategorizace chyb pro lepší UX
        if "Model" in error_message and "not found" in error_message:
            user_message = f"Model '{model_id}' nebyl nalezen. Zkontrolujte dostupné modely."
            current_step = "Model loading failed"
        elif "LoRA" in error_message:
            user_message = f"Chyba při načítání LoRA modelu: {error_message}"
            current_step = "LoRA loading failed"
        elif "generation failed" in error_message.lower():
            user_message = f"AI generování selhalo: {error_message}"
            current_step = "AI generation failed"
        elif "CUDA" in error_message or "memory" in error_message.lower():
            user_message = "Nedostatek GPU paměti. Zkuste snížit rozlišení nebo počet kroků."
            current_step = "GPU memory error"
        elif "No full models available" in error_message:
            user_message = "Nejsou dostupné žádné základní modely. LoRA modely vyžadují základní model."
            current_step = "No base models available"
        else:
            user_message = f"Neočekávaná chyba: {error_message}"
            current_step = "Processing failed"
        
        logger.error(f"Job {job_id} failed [{error_type}]: {error_message}")
        
        jobs_storage[job_id].update({
            "status": "failed",
            "progress": 0,
            "current_step": current_step,
            "error_message": user_message,
            "error_details": {
                "type": error_type,
                "message": error_message,
                "model_id": model_id,
                "parameters": parameters
            },
            "completed_at": datetime.now().timestamp()
        })

@app.post("/api/process")
async def process_image(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    model_id: str = Form(...),
    parameters: str = Form(default="{}")
):
    """Spustí zpracování obrázku"""
    global ai_processor, jobs_storage
    
    if not ai_processor:
        raise HTTPException(status_code=500, detail="AI Processor not initialized")
    
    try:
        # Parse parameters
        params = json.loads(parameters) if parameters else {}
        
        # Generate job ID
        job_id = f"job_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        
        # Read image data
        image_data = await image.read()
        
        # Create job record
        jobs_storage[job_id] = {
            "job_id": job_id,
            "status": "pending",
            "progress": 5,
            "current_step": "Starting processing...",
            "created_at": datetime.now().timestamp(),
            "results": None,
            "error_message": None,
            "completed_at": None
        }
        
        # Start background processing
        background_tasks.add_task(
            process_image_background,
            job_id,
            image_data,
            model_id,
            params
        )
        
        logger.info(f"Started processing job: {job_id}")
        
        return {
            "job_id": job_id,
            "status": "pending",
            "message": "Processing started"
        }
        
    except Exception as e:
        logger.error(f"Error starting processing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start processing: {str(e)}")

@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str):
    """Získá stav zpracování jobu"""
    global jobs_storage
    
    if job_id not in jobs_storage:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_storage[job_id]
    
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "progress": job["progress"],
        "current_step": job.get("current_step"),
        "results": job.get("results", []),
        "error_message": job.get("error_message"),
        "completed_at": job.get("completed_at")
    }

@app.get("/api/jobs")
async def get_all_jobs():
    """Získá seznam všech jobů"""
    global jobs_storage
    
    return {
        "jobs": list(jobs_storage.values()),
        "total_count": len(jobs_storage)
    }

@app.get("/api/debug/version")
async def debug_version():
    """Debug endpoint pro ověření verze a funkcí"""
    return {
        "version": "2.0.0-trae",
        "progress_tracking": "ENABLED",
        "error_handling": "ENHANCED", 
        "model_verification": "ACTIVE",
        "timestamp": datetime.now().isoformat(),
        "ai_processor_loaded": ai_processor is not None,
        "jobs_count": len(jobs_storage)
    }

if __name__ == "__main__":
    # Konfigurace pro RunPod
    host = "0.0.0.0"
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"🚀 Starting server on {host}:{port}")
    
    uvicorn.run(
        "runpod_backend:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )