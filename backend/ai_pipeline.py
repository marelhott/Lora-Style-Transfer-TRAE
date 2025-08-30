#!/usr/bin/env python3
"""
AI Pipeline pro LoRA Style Transfer
Optimalizovaný Stable Diffusion pipeline s CUDA podporou
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Callable
from pathlib import Path
import base64
import io

import torch
import numpy as np
from PIL import Image
from diffusers import (
    StableDiffusionPipeline,
    StableDiffusionImg2ImgPipeline,
    DPMSolverMultistepScheduler,
    EulerAncestralDiscreteScheduler,
    DDIMScheduler,
    LMSDiscreteScheduler
)
from diffusers.utils import make_image_grid
import cv2

from model_manager import model_manager

logger = logging.getLogger(__name__)

class AIProcessor:
    """AI zpracovatel s optimalizacemi pro RunPod GPU"""
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        
        # Scheduler mapping
        self.schedulers = {
            "DPM++ 2M Karras": DPMSolverMultistepScheduler,
            "Euler a": EulerAncestralDiscreteScheduler,
            "DDIM": DDIMScheduler,
            "LMS": LMSDiscreteScheduler
        }
        
        # Optimalizace
        self.enable_xformers = True
        self.enable_cpu_offload = True
        self.enable_attention_slicing = True
        
        logger.info(f"AIProcessor initialized on {self.device}")
    
    def _setup_scheduler(self, pipeline: Any, sampler: str) -> Any:
        """Nastaví scheduler pro pipeline"""
        if sampler in self.schedulers:
            scheduler_class = self.schedulers[sampler]
            pipeline.scheduler = scheduler_class.from_config(pipeline.scheduler.config)
            logger.debug(f"Set scheduler to {sampler}")
        else:
            logger.warning(f"Unknown sampler {sampler}, using default")
        return pipeline
    
    def _preprocess_image(self, image_path: str, target_size: tuple = (512, 512)) -> Image.Image:
        """Předzpracuje vstupní obrázek"""
        try:
            image = Image.open(image_path)
            
            # Konverze na RGB pokud není
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize s udržením poměru stran
            image.thumbnail(target_size, Image.Resampling.LANCZOS)
            
            # Vytvoř nový obrázek s požadovanou velikostí a černým pozadím
            new_image = Image.new('RGB', target_size, (0, 0, 0))
            
            # Vycentruj původní obrázek
            x = (target_size[0] - image.width) // 2
            y = (target_size[1] - image.height) // 2
            new_image.paste(image, (x, y))
            
            logger.debug(f"Preprocessed image to {target_size}")
            return new_image
            
        except Exception as e:
            logger.error(f"Failed to preprocess image {image_path}: {e}")
            raise
    
    def _postprocess_image(self, image: Image.Image, upscale_factor: Optional[int] = None) -> Image.Image:
        """Dodatečné zpracování výsledného obrázku"""
        try:
            if upscale_factor and upscale_factor > 1:
                # Jednoduchý upscaling pomocí Lanczos
                new_size = (image.width * upscale_factor, image.height * upscale_factor)
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                logger.debug(f"Upscaled image by factor {upscale_factor}")
            
            return image
            
        except Exception as e:
            logger.error(f"Failed to postprocess image: {e}")
            return image
    
    def _save_result_image(self, image: Image.Image, output_path: str) -> str:
        """Uloží výsledný obrázek"""
        try:
            image.save(output_path, "PNG", quality=95)
            logger.debug(f"Saved result image to {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Failed to save image to {output_path}: {e}")
            raise
    
    async def process_style_transfer(
        self,
        job_id: str,
        input_image_path: str,
        model_id: str,
        parameters: Dict,
        lora_id: Optional[str] = None,
        lora_weight: float = 1.0,
        progress_callback: Optional[Callable] = None
    ) -> List[Dict]:
        """Hlavní funkce pro stylový transfer"""
        
        results = []
        start_time = time.time()
        
        try:
            # Progress callback
            if progress_callback:
                await progress_callback(job_id, "loading_model", "Loading AI model...", 10.0)
            
            # Načti model
            pipeline = await model_manager.load_model(model_id)
            
            # Nastav scheduler
            pipeline = self._setup_scheduler(pipeline, parameters.get('sampler', 'DPM++ 2M Karras'))
            
            # Načti LoRA pokud je specifikována
            if lora_id:
                if progress_callback:
                    await progress_callback(job_id, "loading_model", "Loading LoRA...", 15.0)
                pipeline = await model_manager.load_lora(lora_id, pipeline, lora_weight)
            
            # Předzpracuj vstupní obrázek
            if progress_callback:
                await progress_callback(job_id, "loading_model", "Preprocessing image...", 20.0)
            
            input_image = self._preprocess_image(input_image_path)
            
            # Parametry pro generování
            generation_params = {
                "image": input_image,
                "strength": parameters.get('strength', 0.8),
                "guidance_scale": parameters.get('cfgScale', 7.5),
                "num_inference_steps": parameters.get('steps', 20),
                "num_images_per_prompt": parameters.get('batchCount', 1),
                "generator": torch.Generator(device=self.device).manual_seed(
                    parameters.get('seed', int(time.time()))
                ) if parameters.get('seed') else None
            }
            
            # Generování
            if progress_callback:
                await progress_callback(job_id, "generating", "Generating images...", 30.0)
            
            logger.info(f"Starting generation with parameters: {generation_params}")
            
            # Použij img2img pipeline
            if not hasattr(pipeline, 'img2img'):
                # Konvertuj na img2img pipeline
                img2img_pipeline = StableDiffusionImg2ImgPipeline(
                    vae=pipeline.vae,
                    text_encoder=pipeline.text_encoder,
                    tokenizer=pipeline.tokenizer,
                    unet=pipeline.unet,
                    scheduler=pipeline.scheduler,
                    safety_checker=pipeline.safety_checker,
                    feature_extractor=pipeline.feature_extractor,
                    requires_safety_checker=pipeline.config.requires_safety_checker
                )
                img2img_pipeline = img2img_pipeline.to(self.device)
            else:
                img2img_pipeline = pipeline
            
            # Generuj obrázky
            with torch.autocast(self.device, dtype=self.dtype):
                result = img2img_pipeline(
                    prompt="",  # Prázdný prompt pro style transfer
                    **generation_params
                )
            
            # Zpracuj výsledky
            if progress_callback:
                await progress_callback(job_id, "upscaling", "Processing results...", 80.0)
            
            output_dir = Path(f"/tmp/processing/{job_id}")
            output_dir.mkdir(parents=True, exist_ok=True)
            
            for i, image in enumerate(result.images):
                # Post-processing
                processed_image = self._postprocess_image(
                    image, 
                    parameters.get('upscaleFactor')
                )
                
                # Uložení
                output_path = output_dir / f"result_{i}.png"
                self._save_result_image(processed_image, str(output_path))
                
                # Konverze na base64 pro API response
                buffer = io.BytesIO()
                processed_image.save(buffer, format='PNG')
                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                results.append({
                    "imageUrl": f"data:image/png;base64,{image_base64}",
                    "seed": parameters.get('seed', int(time.time())) + i,
                    "parameters": {
                        "strength": parameters.get('strength', 0.8),
                        "cfgScale": parameters.get('cfgScale', 7.5),
                        "steps": parameters.get('steps', 20),
                        "sampler": parameters.get('sampler', 'DPM++ 2M Karras')
                    },
                    "modelName": model_manager.get_model_info(model_id)['name'],
                    "loraName": model_manager.get_model_info(lora_id)['name'] if lora_id else None,
                    "processingTime": time.time() - start_time,
                    "filePath": str(output_path)
                })
            
            if progress_callback:
                await progress_callback(job_id, "completed", "Processing completed!", 100.0)
            
            logger.info(f"Generated {len(results)} images in {time.time() - start_time:.2f}s")
            return results
            
        except Exception as e:
            logger.error(f"Error during style transfer: {e}")
            if progress_callback:
                await progress_callback(job_id, "failed", f"Error: {str(e)}", 0.0)
            raise
    
    async def process_text_to_image(
        self,
        job_id: str,
        prompt: str,
        model_id: str,
        parameters: Dict,
        lora_id: Optional[str] = None,
        lora_weight: float = 1.0,
        progress_callback: Optional[Callable] = None
    ) -> List[Dict]:
        """Text-to-image generování"""
        
        results = []
        start_time = time.time()
        
        try:
            # Progress callback
            if progress_callback:
                await progress_callback(job_id, "loading_model", "Loading AI model...", 10.0)
            
            # Načti model
            pipeline = await model_manager.load_model(model_id)
            
            # Nastav scheduler
            pipeline = self._setup_scheduler(pipeline, parameters.get('sampler', 'DPM++ 2M Karras'))
            
            # Načti LoRA pokud je specifikována
            if lora_id:
                if progress_callback:
                    await progress_callback(job_id, "loading_model", "Loading LoRA...", 15.0)
                pipeline = await model_manager.load_lora(lora_id, pipeline, lora_weight)
            
            # Parametry pro generování
            generation_params = {
                "prompt": prompt,
                "height": 512,
                "width": 512,
                "guidance_scale": parameters.get('cfgScale', 7.5),
                "num_inference_steps": parameters.get('steps', 20),
                "num_images_per_prompt": parameters.get('batchCount', 1),
                "generator": torch.Generator(device=self.device).manual_seed(
                    parameters.get('seed', int(time.time()))
                ) if parameters.get('seed') else None
            }
            
            # Generování
            if progress_callback:
                await progress_callback(job_id, "generating", "Generating images...", 30.0)
            
            logger.info(f"Starting text-to-image generation: {prompt}")
            
            with torch.autocast(self.device, dtype=self.dtype):
                result = pipeline(**generation_params)
            
            # Zpracuj výsledky
            if progress_callback:
                await progress_callback(job_id, "upscaling", "Processing results...", 80.0)
            
            output_dir = Path(f"/tmp/processing/{job_id}")
            output_dir.mkdir(parents=True, exist_ok=True)
            
            for i, image in enumerate(result.images):
                # Post-processing
                processed_image = self._postprocess_image(
                    image, 
                    parameters.get('upscaleFactor')
                )
                
                # Uložení
                output_path = output_dir / f"result_{i}.png"
                self._save_result_image(processed_image, str(output_path))
                
                # Konverze na base64
                buffer = io.BytesIO()
                processed_image.save(buffer, format='PNG')
                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                results.append({
                    "imageUrl": f"data:image/png;base64,{image_base64}",
                    "seed": parameters.get('seed', int(time.time())) + i,
                    "parameters": {
                        "strength": 1.0,  # Text-to-image má vždy plnou sílu
                        "cfgScale": parameters.get('cfgScale', 7.5),
                        "steps": parameters.get('steps', 20),
                        "sampler": parameters.get('sampler', 'DPM++ 2M Karras')
                    },
                    "modelName": model_manager.get_model_info(model_id)['name'],
                    "loraName": model_manager.get_model_info(lora_id)['name'] if lora_id else None,
                    "processingTime": time.time() - start_time,
                    "filePath": str(output_path),
                    "prompt": prompt
                })
            
            if progress_callback:
                await progress_callback(job_id, "completed", "Processing completed!", 100.0)
            
            logger.info(f"Generated {len(results)} images in {time.time() - start_time:.2f}s")
            return results
            
        except Exception as e:
            logger.error(f"Error during text-to-image generation: {e}")
            if progress_callback:
                await progress_callback(job_id, "failed", f"Error: {str(e)}", 0.0)
            raise
    
    def get_performance_stats(self) -> Dict:
        """Vrátí statistiky výkonu"""
        stats = {
            "device": self.device,
            "dtype": str(self.dtype),
            "memory_info": model_manager.get_memory_usage()
        }
        
        if torch.cuda.is_available():
            stats.update({
                "gpu_name": torch.cuda.get_device_name(),
                "gpu_memory_total": torch.cuda.get_device_properties(0).total_memory,
                "gpu_memory_allocated": torch.cuda.memory_allocated(),
                "gpu_memory_reserved": torch.cuda.memory_reserved()
            })
        
        return stats

# Globální instance
ai_processor = AIProcessor()