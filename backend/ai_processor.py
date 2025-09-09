#!/usr/bin/env python3
"""
AI Processor pro LoRA Style Transfer
Zpracovává obrázky pomocí AI modelů s reálným Stable Diffusion pipeline
"""

import os
import json
import uuid
import gc
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import logging
import asyncio
from datetime import datetime

import torch
import numpy as np
from PIL import Image
import io
import base64

# Diffusers imports
from diffusers import (
    StableDiffusionImg2ImgPipeline,
    StableDiffusionPipeline,
    DiffusionPipeline,
    DPMSolverMultistepScheduler,
    EulerAncestralDiscreteScheduler,
    EulerDiscreteScheduler,
    LMSDiscreteScheduler,
    HeunDiscreteScheduler,
    KDPM2DiscreteScheduler,
    KDPM2AncestralDiscreteScheduler
)
from transformers import CLIPTextModel, CLIPTokenizer
from safetensors.torch import load_file
import accelerate

logger = logging.getLogger(__name__)

class AIProcessor:
    """AI Processor pro zpracování obrázků s LoRA styly pomocí Stable Diffusion"""
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.output_path = Path("/data/outputs")
        
        # Vytvoř output složku
        self.output_path.mkdir(parents=True, exist_ok=True)
        
        # Model manager
        self.model_manager = ModelManager()
        
        # Current pipeline state
        self.current_pipeline = None
        self.current_model_id = None
        self.loaded_loras = set()
        
        # Scheduler mapping
        self.schedulers = {
            "Euler a": EulerAncestralDiscreteScheduler,
            "Euler": EulerDiscreteScheduler,
            "LMS": LMSDiscreteScheduler,
            "Heun": HeunDiscreteScheduler,
            "DPM2": KDPM2DiscreteScheduler,
            "DPM2 a": KDPM2AncestralDiscreteScheduler,
            "DPM++ 2M": DPMSolverMultistepScheduler,
        }
        
        logger.info(f"AIProcessor initialized on device: {self.device}")
        logger.info(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            logger.info(f"GPU: {torch.cuda.get_device_name()}")
            logger.info(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
    
    def _load_pipeline(self, model_id: str) -> StableDiffusionImg2ImgPipeline:
        """Načte Stable Diffusion pipeline pro daný model"""
        if self.current_model_id == model_id and self.current_pipeline is not None:
            logger.info(f"Using cached pipeline for model: {model_id}")
            return self.current_pipeline
        
        # Vyčisti předchozí pipeline z paměti
        if self.current_pipeline is not None:
            self._cleanup_pipeline()
        
        # Načti pipeline přes model manager
        try:
            pipeline = self.model_manager.load_model(model_id)
            self.current_pipeline = pipeline
            self.current_model_id = model_id
            self.loaded_loras.clear()  # Reset LoRA state
            
            logger.info(f"Pipeline loaded successfully for model: {model_id}")
            return pipeline
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            raise e
    
    def _load_lora(self, pipeline: StableDiffusionImg2ImgPipeline, lora_id: str, weight: float = 1.0):
        """Načte a aplikuje LoRA na pipeline"""
        if lora_id in self.loaded_loras:
            logger.info(f"LoRA {lora_id} already loaded")
            return
        
        lora_info = self.model_manager.get_model_info(lora_id)
        if not lora_info or lora_info.type != "lora":
            raise FileNotFoundError(f"LoRA {lora_id} not found")
        
        logger.info(f"Loading LoRA: {lora_id} with weight {weight}")
        
        try:
            # Načti LoRA weights
            if lora_info.format == "safetensors":
                lora_weights = load_file(lora_info.path)
            else:
                lora_weights = torch.load(lora_info.path, map_location=self.device)
            
            # Aplikuj LoRA na pipeline (simplified - v reálné implementaci by bylo složitější)
            if hasattr(pipeline, "load_lora_weights"):
                pipeline.load_lora_weights(str(lora_info.path))
                if hasattr(pipeline, "set_adapters"):
                    pipeline.set_adapters([lora_id], adapter_weights=[weight])
            else:
                logger.warning(f"Pipeline doesn't support LoRA loading")
            
            self.loaded_loras.add(lora_id)
            logger.info(f"LoRA {lora_id} loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load LoRA {lora_id}: {e}")
            raise e
    
    def _cleanup_pipeline(self):
        """Vyčistí současný pipeline"""
        if self.current_pipeline is not None:
            del self.current_pipeline
            self.current_pipeline = None
            self.current_model_id = None
            self.loaded_loras.clear()
            torch.cuda.empty_cache()
            gc.collect()
    
    def _set_scheduler(self, pipeline: StableDiffusionImg2ImgPipeline, sampler: str):
        """Nastaví scheduler podle názvu sampleru"""
        if sampler in self.schedulers:
            scheduler_class = self.schedulers[sampler]
            pipeline.scheduler = scheduler_class.from_config(pipeline.scheduler.config)
            logger.info(f"Scheduler set to: {sampler}")
        else:
            logger.warning(f"Unknown sampler: {sampler}, using default")
    
    async def process_image(self, image_data: bytes, model_id: str, parameters: Dict) -> Dict:
        """Zpracuje obrázek s daným modelem a parametry pomocí Stable Diffusion"""
        try:
            logger.info(f"Processing image with model: {model_id}")
            logger.info(f"Parameters: {parameters}")
            
            # Načti a připrav vstupní obrázek
            input_image = Image.open(io.BytesIO(image_data)).convert("RGB")
            logger.info(f"Input image loaded: {input_image.size}")
            
            # Resize image pokud je příliš velký (pro memory management)
            max_size = 768
            if max(input_image.size) > max_size:
                ratio = max_size / max(input_image.size)
                new_size = tuple(int(dim * ratio) for dim in input_image.size)
                input_image = input_image.resize(new_size, Image.Resampling.LANCZOS)
                logger.info(f"Image resized to: {input_image.size}")
            
            # Načti pipeline
            pipeline = self._load_pipeline(model_id)
            
            # Nastavení parametrů
            strength = parameters.get("strength", 0.7)
            guidance_scale = parameters.get("cfgScale", 7.5)
            num_inference_steps = parameters.get("steps", 20)
            sampler = parameters.get("sampler", "Euler a")
            seed = parameters.get("seed")
            lora_models = parameters.get("loras", [])  # Seznam LoRA modelů
            prompt = parameters.get("prompt", "high quality, detailed, masterpiece")
            negative_prompt = parameters.get("negative_prompt", "low quality, blurry, artifacts")
            
            # Nastavení scheduleru
            self._set_scheduler(pipeline, sampler)
            
            # Načti LoRA modely pokud jsou specifikované
            for lora_config in lora_models:
                if isinstance(lora_config, dict):
                    lora_id = lora_config.get("id")
                    lora_weight = lora_config.get("weight", 1.0)
                elif isinstance(lora_config, str):
                    lora_id = lora_config
                    lora_weight = 1.0
                else:
                    continue
                
                if lora_id:
                    try:
                        self._load_lora(pipeline, lora_id, lora_weight)
                    except Exception as e:
                        logger.warning(f"Failed to load LoRA {lora_id}: {e}")
            
            # Generování
            generator = None
            if seed is not None:
                generator = torch.Generator(device=self.device).manual_seed(int(seed))
            else:
                seed = torch.randint(0, 2**32, (1,)).item()
                generator = torch.Generator(device=self.device).manual_seed(seed)
            
            logger.info(f"Starting generation with seed: {seed}")
            
            # Spusť generování
            with torch.autocast(self.device):
                result_images = pipeline(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    image=input_image,
                    strength=strength,
                    guidance_scale=guidance_scale,
                    num_inference_steps=num_inference_steps,
                    generator=generator,
                    num_images_per_request=1
                ).images
            
            # Uložení výsledku
            result_id = str(uuid.uuid4())
            result_filename = f"result_{result_id}.jpg"
            result_path = self.output_path / result_filename
            
            generated_image = result_images[0]
            generated_image.save(result_path, "JPEG", quality=95)
            
            # Vytvoř base64 URL pro frontend
            with open(result_path, "rb") as f:
                image_bytes = f.read()
                image_base64 = base64.b64encode(image_bytes).decode()
                image_url = f"data:image/jpeg;base64,{image_base64}"
            
            result = {
                "id": result_id,
                "image_url": image_url,
                "prompt": f"Generated with {model_id}",
                "model_id": model_id,
                "parameters": {
                    **parameters,
                    "seed": seed
                },
                "timestamp": datetime.now().isoformat(),
                "file_path": str(result_path)
            }
            
            logger.info(f"Processing completed: {result_id}")
            
            # Vyčisti GPU paměť
            torch.cuda.empty_cache()
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            # Vyčisti GPU paměť i při chybě
            torch.cuda.empty_cache()
            raise e
    
    def get_available_models(self) -> List[Dict]:
        """Vrátí seznam dostupných modelů"""
        return self.model_manager.get_models()
    
    def get_available_loras(self) -> List[Dict]:
        """Vrátí seznam dostupných LoRA modelů"""
        return self.model_manager.get_loras()
    
    def scan_models(self) -> Tuple[int, int]:
        """Skenuje disky pro nové modely"""
        return self.model_manager.scan_models()
    
    def get_performance_stats(self) -> Dict:
        """Vrátí statistiky výkonu"""
        stats = self.model_manager.get_stats()
        stats.update({
            "current_model": self.current_model_id,
            "pipeline_loaded": self.current_pipeline is not None,
            "loaded_loras": list(self.loaded_loras)
        })
        return stats
    
    def cleanup(self):
        """Vyčistí paměť a uvolní zdroje"""
        self._cleanup_pipeline()
        self.model_manager.cleanup()
        logger.info("AI Processor cleanup completed")
