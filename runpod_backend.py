#!/usr/bin/env python3
"""
Standalone LoRA Style Transfer Backend pro RunPod
Optimalizováno pro přímé spuštění bez Docker na RunPod s persistentním diskem
"""

import os
import sys
import asyncio
import uuid
import json
import base64
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
from PIL import Image
import io

# FastAPI imports
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

# AI/ML imports
import torch
import gc
try:
    from diffusers import StableDiffusionPipeline, DiffusionPipeline
    from diffusers.utils import load_image
    import transformers
    print("✅ Diffusers loaded successfully")
except ImportError as e:
    print(f"❌ Error importing diffusers: {e}")
    print("Installing diffusers...")
    os.system("pip install diffusers transformers accelerate")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global configuration
class Config:
    """Configuration for RunPod deployment"""
    
    # Paths - automatically detect RunPod environment
    BASE_PATH = Path("/data") if Path("/data").exists() else Path("/workspace")
    MODELS_PATH = BASE_PATH / "models"
    LORAS_PATH = BASE_PATH / "loras" 
    TEMP_PATH = Path("/tmp/processing")
    FRONTEND_PATH = Path(__file__).parent / "build"  # Next.js build output
    
    # Ensure directories exist
    MODELS_PATH.mkdir(parents=True, exist_ok=True)
    LORAS_PATH.mkdir(parents=True, exist_ok=True)
    TEMP_PATH.mkdir(parents=True, exist_ok=True)
    
    # GPU settings
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    TORCH_DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32
    
    print(f"🔧 Config initialized:")
    print(f"   Models: {MODELS_PATH}")
    print(f"   LoRAs: {LORAS_PATH}")
    print(f"   Device: {DEVICE}")
    print(f"   Frontend: {FRONTEND_PATH}")

config = Config()

# FastAPI app
app = FastAPI(
    title="LoRA Style Transfer API",
    description="Standalone backend for RunPod deployment",
    version="2.0.0"
)

# CORS - allow all for RunPod proxy URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
processing_jobs: Dict[str, Dict] = {}
loaded_models: Dict[str, Any] = {}
model_manager = None

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
    type: str
    fileSize: int
    uploadedAt: int
    isActive: bool
    metadata: Optional[Dict] = None

class SimpleModelManager:
    """Simplified model manager for RunPod"""
    
    def __init__(self):
        self.models = {}
        self.loaded_pipeline = None
        self.current_model_id = None
        self.scan_models()
    
    def scan_models(self):
        """Scan for available models"""
        models = []
        
        # Scan full models
        if config.MODELS_PATH.exists():
            for model_file in config.MODELS_PATH.rglob("*.safetensors"):
                if model_file.is_file():
                    stat = model_file.stat()
                    models.append({
                        "id": f"model_{model_file.stem}",
                        "name": model_file.stem,
                        "type": "full",
                        "path": str(model_file),
                        "fileSize": stat.st_size,
                        "uploadedAt": int(stat.st_mtime),
                        "isActive": False
                    })
        
        # Scan LoRA models
        if config.LORAS_PATH.exists():
            for lora_file in config.LORAS_PATH.rglob("*.safetensors"):
                if lora_file.is_file():
                    stat = lora_file.stat()
                    models.append({
                        "id": f"lora_{lora_file.stem}",
                        "name": lora_file.stem,
                        "type": "lora",
                        "path": str(lora_file),
                        "fileSize": stat.st_size,
                        "uploadedAt": int(stat.st_mtime),
                        "isActive": False
                    })
        
        self.models = {m["id"]: m for m in models}
        logger.info(f"📋 Found {len(models)} models: {len([m for m in models if m['type'] == 'full'])} full, {len([m for m in models if m['type'] == 'lora'])} LoRA")
        return models
    
    def get_models(self):
        """Get list of available models"""
        return list(self.models.values())
    
    def load_model(self, model_id: str):
        """Load a specific model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        model_info = self.models[model_id]
        if model_info["type"] != "full":
            raise ValueError(f"Can only load full models, got {model_info['type']}")
        
        if self.current_model_id == model_id and self.loaded_pipeline:
            logger.info(f"✅ Model {model_id} already loaded")
            return self.loaded_pipeline
        
        # Clear previous model
        if self.loaded_pipeline:
            del self.loaded_pipeline
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        # Load new model
        model_path = model_info["path"]
        logger.info(f"🔄 Loading model: {model_path}")
        
        try:
            pipeline = StableDiffusionPipeline.from_single_file(
                model_path,
                torch_dtype=config.TORCH_DTYPE,
                use_safetensors=True
            )
            
            if config.DEVICE == "cuda":
                pipeline = pipeline.to("cuda")
                # Memory optimizations
                pipeline.enable_model_cpu_offload()
                pipeline.enable_attention_slicing()
            
            self.loaded_pipeline = pipeline
            self.current_model_id = model_id
            
            logger.info(f"✅ Model loaded successfully: {model_id}")
            return pipeline
            
        except Exception as e:
            logger.error(f"❌ Failed to load model {model_id}: {e}")
            raise

# Initialize model manager
model_manager = SimpleModelManager()

def clear_gpu_memory():
    """Clear GPU memory"""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

async def update_job_progress(job_id: str, status: str, step: str, progress: float):
    """Update job progress"""
    if job_id in processing_jobs:
        processing_jobs[job_id].update({
            "status": status,
            "current_step": step,
            "progress": progress,
            "updated_at": datetime.now().isoformat()
        })

# API Routes
@app.get("/")
async def root():
    """Health check"""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "cuda_available": True,
            "device_count": torch.cuda.device_count(),
            "device_name": torch.cuda.get_device_name(),
            "memory_allocated": torch.cuda.memory_allocated(),
            "memory_reserved": torch.cuda.memory_reserved(),
        }
    else:
        gpu_info = {"cuda_available": False}
    
    return {
        "message": "LoRA Style Transfer API (RunPod Standalone)",
        "status": "running",
        "config": {
            "models_path": str(config.MODELS_PATH),
            "loras_path": str(config.LORAS_PATH),
            "device": config.DEVICE
        },
        "gpu_info": gpu_info,
        "models_available": len(model_manager.models)
    }

@app.get("/api/models")
async def get_models():
    """Get available models"""
    try:
        # Rescan to pick up any new models
        models = model_manager.scan_models()
        return models
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "cuda_available": True,
            "device_count": torch.cuda.device_count(),
            "device_name": torch.cuda.get_device_name(),
            "memory_allocated": torch.cuda.memory_allocated(),
            "memory_reserved": torch.cuda.memory_reserved(),
        }
    
    models = model_manager.get_models()
    full_models = [m for m in models if m["type"] == "full"]
    lora_models = [m for m in models if m["type"] == "lora"]
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "gpu_info": gpu_info,
        "models_count": len(full_models),
        "loras_count": len(lora_models),
        "models_available": len(models),
        "active_jobs": len([j for j in processing_jobs.values() if j["status"] in ["pending", "processing"]]),
        "config": {
            "models_path": str(config.MODELS_PATH),
            "loras_path": str(config.LORAS_PATH),
            "device": config.DEVICE,
            "torch_dtype": str(config.TORCH_DTYPE)
        }
    }

@app.post("/api/process")
async def start_processing(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    model_id: str = Form(...),
    parameters: str = Form(...)
):
    """Start image processing"""
    try:
        # Parse parameters
        params = ProcessingParameters(**json.loads(parameters))
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Save uploaded image
        image_data = await image.read()
        image_path = config.TEMP_PATH / f"{job_id}_input.png"
        
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
        background_tasks.add_task(process_image_simple, job_id)
        
        return {"job_id": job_id, "status": "pending"}
        
    except Exception as e:
        logger.error(f"Failed to start processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str):
    """Get job status"""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return processing_jobs[job_id]

async def process_image_simple(job_id: str):
    """Simple image processing for RunPod"""
    job = processing_jobs[job_id]
    
    try:
        await update_job_progress(job_id, "processing", "Loading model...", 10)
        
        # Get model info
        model_id = job["model_id"]
        if model_id.startswith("lora_"):
            # For LoRA, use first available full model as base
            full_models = [m for m in model_manager.get_models() if m["type"] == "full"]
            if not full_models:
                raise ValueError("No base model found for LoRA")
            base_model_id = full_models[0]["id"]
        else:
            base_model_id = model_id
        
        # Load model
        pipeline = model_manager.load_model(base_model_id)
        await update_job_progress(job_id, "processing", "Model loaded, generating...", 30)
        
        # Load input image
        input_image_path = job["input_image"]
        input_image = Image.open(input_image_path).convert("RGB")
        
        # Generate image
        parameters = job["parameters"]
        
        result = pipeline(
            prompt="",  # Use for img2img style transfer
            image=input_image,
            strength=parameters.get("strength", 0.8),
            guidance_scale=parameters.get("cfgScale", 7.5),
            num_inference_steps=parameters.get("steps", 20),
            generator=torch.Generator(device=config.DEVICE).manual_seed(
                parameters.get("seed", 42)
            ) if parameters.get("seed") else None
        )
        
        await update_job_progress(job_id, "processing", "Saving results...", 90)
        
        # Save result
        output_image = result.images[0]
        output_path = config.TEMP_PATH / f"{job_id}_output.png"
        output_image.save(output_path)
        
        # Create result data
        with open(output_path, "rb") as f:
            image_data = f.read()
            image_base64 = base64.b64encode(image_data).decode()
        
        results = [{
            "imageUrl": f"data:image/png;base64,{image_base64}",
            "seed": parameters.get("seed", 42),
            "parameters": parameters
        }]
        
        # Update job as completed
        job["status"] = "completed" 
        job["current_step"] = "Completed!"
        job["progress"] = 100.0
        job["results"] = results
        job["completed_at"] = datetime.now().isoformat()
        
        logger.info(f"✅ Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Job {job_id} failed: {e}")
        job["status"] = "failed"
        job["error_message"] = str(e)
        job["current_step"] = f"Error: {str(e)}"
        job["completed_at"] = datetime.now().isoformat()
    
    finally:
        # Clean up
        clear_gpu_memory()

# Serve frontend (if built)
if config.FRONTEND_PATH.exists():
    app.mount("/", StaticFiles(directory=config.FRONTEND_PATH, html=True), name="frontend")
    logger.info(f"✅ Frontend served from {config.FRONTEND_PATH}")

def main():
    """Main entry point"""
    print("🚀 Starting LoRA Style Transfer Backend (RunPod Standalone)")
    print(f"📁 Models path: {config.MODELS_PATH}")
    print(f"📁 LoRAs path: {config.LORAS_PATH}")
    print(f"🎮 Device: {config.DEVICE}")
    
    # Scan models on startup
    models = model_manager.scan_models()
    print(f"📋 Found {len(models)} models")
    
    # Start server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

if __name__ == "__main__":
    main()
