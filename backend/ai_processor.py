#!/usr/bin/env python3
"""
AI Processor pro LoRA Style Transfer
Zpracovává obrázky pomocí AI modelů s reálným Stable Diffusion pipeline
"""

import os
import uuid
import gc
from pathlib import Path
from typing import Dict, Optional, Any
import logging
import asyncio
from datetime import datetime

import torch
from PIL import Image
import io
import base64

# Diffusers imports
from diffusers import StableDiffusionPipeline

logger = logging.getLogger(__name__)

class AIProcessor:
    """Simplified AI processor for style transfer using Stable Diffusion."""
    
    def __init__(self, model_path: str = "/data/models"):
        self.model_path = Path(model_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.pipe = None
        
        # Performance settings
        self.torch_dtype = torch.float16 if self.device == "cuda" else torch.float32
        
        logger.info(f"AIProcessor initialized with device: {self.device}")
        
    async def initialize(self):
        """Initialize the AI processor with default model."""
        try:
            await self.load_model("runwayml/stable-diffusion-v1-5")
            logger.info("AIProcessor initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AIProcessor: {e}")
            raise
    
    async def load_model(self, model_id: str):
        """Load a Stable Diffusion model."""
        try:
            if self.pipe is not None:
                del self.pipe
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            
            logger.info(f"Loading model: {model_id}")
            
            self.pipe = StableDiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=self.torch_dtype,
                safety_checker=None,
                requires_safety_checker=False
            ).to(self.device)
            
            logger.info(f"Model {model_id} loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            raise
    
    async def process_image(
        self, 
        input_image: Image.Image, 
        prompt: str = "high quality photo",
        negative_prompt: str = "blurry, low quality",
        strength: float = 0.8,
        guidance_scale: float = 7.5,
        num_inference_steps: int = 20
    ) -> Image.Image:
        """Process image with style transfer."""
        try:
            if self.pipe is None:
                raise ValueError("Model not loaded. Call initialize() first.")
            
            logger.info(f"Processing image with prompt: {prompt}")
            
            # Convert to RGB if needed
            if input_image.mode != "RGB":
                input_image = input_image.convert("RGB")
            
            # Generate image
            result = self.pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=input_image,
                strength=strength,
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps,
                generator=torch.Generator(device=self.device).manual_seed(42)
            )
            
            return result.images[0]
            
        except Exception as e:
            logger.error(f"Failed to process image: {e}")
            raise
    
    def cleanup(self):
        """Clean up resources."""
        if self.pipe is not None:
            del self.pipe
            self.pipe = None
        
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("AI Processor cleanup completed")
