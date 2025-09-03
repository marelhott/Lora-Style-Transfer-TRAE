#!/usr/bin/env python3
"""
Model Manager pro LoRA Style Transfer
Spravuje načítání, cache a optimalizaci AI modelů
"""

import os
import json
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import logging
from datetime import datetime

import torch
import gc
from safetensors.torch import load_file
from diffusers import StableDiffusionPipeline, DiffusionPipeline
from diffusers.utils import logging as diffusers_logging

# Nastavení loggingu
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
diffusers_logging.set_verbosity_error()

class ModelManager:
    """Správce AI modelů s optimalizací pro RunPod GPU"""
    
    def __init__(self, models_path: str = "/data/models", loras_path: str = "/data/loras"):
        self.models_path = Path(models_path)
        self.loras_path = Path(loras_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Cache pro načtené modely
        self.loaded_models: Dict[str, Any] = {}
        self.loaded_loras: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict] = {}
        
        # Konfigurace
        self.max_models_in_memory = 2  # Maximální počet modelů v paměti
        self.enable_cpu_offload = True  # CPU offload pro úsporu VRAM
        self.enable_attention_slicing = True  # Attention slicing
        
        logger.info(f"ModelManager initialized on device: {self.device}")
        logger.info(f"Models path: {self.models_path}")
        logger.info(f"LoRAs path: {self.loras_path}")
        
        # Naskenuj dostupné modely
        self._scan_models()
    
    def _scan_models(self):
        """Naskenuje dostupné modely a LoRA"""
        logger.info("Scanning available models...")
        
        # Scan Stable Diffusion models
        if self.models_path.exists():
            for model_file in self.models_path.rglob("*.safetensors"):
                if model_file.is_file():
                    self._register_model(model_file, "full")
            
            # Také hledej .ckpt soubory
            for model_file in self.models_path.rglob("*.ckpt"):
                if model_file.is_file():
                    self._register_model(model_file, "full")
        
        # Scan LoRA models
        if self.loras_path.exists():
            for lora_file in self.loras_path.rglob("*.safetensors"):
                if lora_file.is_file():
                    self._register_model(lora_file, "lora")
        
        logger.info(f"Found {len(self.model_metadata)} models total")
    
    def _register_model(self, model_path: Path, model_type: str):
        """Registruje model do metadata cache"""
        try:
            stat = model_path.stat()
            model_id = f"{model_type}_{model_path.stem}"
            
            # Vytvoř hash pro identifikaci
            model_hash = self._calculate_file_hash(model_path)
            
            self.model_metadata[model_id] = {
                "id": model_id,
                "name": model_path.stem,
                "type": model_type,
                "path": str(model_path),
                "fileSize": stat.st_size,
                "uploadedAt": int(stat.st_mtime * 1000),
                "isActive": True,
                "hash": model_hash,
                "metadata": {
                    "description": f"{model_type.upper()} model: {model_path.stem}",
                    "category": model_type,
                    "format": model_path.suffix[1:],  # bez tečky
                    "last_used": None
                }
            }
            
            logger.debug(f"Registered {model_type} model: {model_path.stem}")
            
        except Exception as e:
            logger.error(f"Failed to register model {model_path}: {e}")
    
    def _calculate_file_hash(self, file_path: Path, chunk_size: int = 8192) -> str:
        """Vypočítá SHA256 hash souboru"""
        hash_sha256 = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                # Čti pouze první chunk pro rychlost
                chunk = f.read(chunk_size)
                hash_sha256.update(chunk)
            return hash_sha256.hexdigest()[:16]  # Zkrácený hash
        except Exception as e:
            logger.warning(f"Could not calculate hash for {file_path}: {e}")
            return "unknown"
    
    def get_available_models(self) -> List[Dict]:
        """Vrátí seznam dostupných modelů"""
        return list(self.model_metadata.values())

    def get_models(self) -> List[Dict]:
        """Alias pro get_available_models - kompatibilita s main.py"""
        return self.get_available_models()

    def scan_models(self):
        """Veřejná metoda pro rescan modelů"""
        self.model_metadata.clear()
        self._scan_models()
        logger.info(f"Rescanned models: {len(self.model_metadata)} found")
    
    def get_model_info(self, model_id: str) -> Optional[Dict]:
        """Vrátí informace o konkrétním modelu"""
        return self.model_metadata.get(model_id)
    
    def _clear_gpu_memory(self):
        """Vyčistí GPU paměť"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            gc.collect()
            logger.debug("GPU memory cleared")
    
    def _unload_oldest_model(self):
        """Uvolní nejstarší model z paměti"""
        if not self.loaded_models:
            return
        
        # Najdi nejstarší model podle last_used
        oldest_model = None
        oldest_time = float('inf')
        
        for model_id, model_data in self.loaded_models.items():
            if model_data.get('last_used', 0) < oldest_time:
                oldest_time = model_data.get('last_used', 0)
                oldest_model = model_id
        
        if oldest_model:
            logger.info(f"Unloading oldest model: {oldest_model}")
            del self.loaded_models[oldest_model]
            self._clear_gpu_memory()
    
    async def load_model(self, model_id: str) -> Any:
        """Načte Stable Diffusion model"""
        if model_id in self.loaded_models:
            # Model už je načtený, aktualizuj last_used
            self.loaded_models[model_id]['last_used'] = datetime.now().timestamp()
            logger.debug(f"Model {model_id} already loaded")
            return self.loaded_models[model_id]['pipeline']
        
        model_info = self.get_model_info(model_id)
        if not model_info:
            raise ValueError(f"Model {model_id} not found")
        
        if model_info['type'] != 'full':
            raise ValueError(f"Model {model_id} is not a full Stable Diffusion model")
        
        # Zkontroluj paměť a případně uvolni staré modely
        if len(self.loaded_models) >= self.max_models_in_memory:
            self._unload_oldest_model()
        
        logger.info(f"Loading Stable Diffusion model: {model_info['name']}")
        
        try:
            model_path = model_info['path']
            
            # Načti model podle formátu
            if model_path.endswith('.safetensors'):
                pipeline = StableDiffusionPipeline.from_single_file(
                    model_path,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    use_safetensors=True
                )
            elif model_path.endswith('.ckpt'):
                pipeline = StableDiffusionPipeline.from_single_file(
                    model_path,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
                )
            else:
                raise ValueError(f"Unsupported model format: {model_path}")
            
            # Optimalizace pro GPU
            if self.device == "cuda":
                pipeline = pipeline.to(self.device)
                
                # Povolí memory efficient attention
                if hasattr(pipeline.unet, 'set_use_memory_efficient_attention_xformers'):
                    try:
                        pipeline.unet.set_use_memory_efficient_attention_xformers(True)
                        logger.debug("Enabled xformers memory efficient attention")
                    except Exception as e:
                        logger.warning(f"Could not enable xformers: {e}")
                
                # Attention slicing pro úsporu VRAM
                if self.enable_attention_slicing:
                    pipeline.enable_attention_slicing()
                    logger.debug("Enabled attention slicing")
                
                # CPU offload pro úsporu VRAM
                if self.enable_cpu_offload:
                    pipeline.enable_model_cpu_offload()
                    logger.debug("Enabled CPU offload")
            
            # Uložit do cache
            self.loaded_models[model_id] = {
                'pipeline': pipeline,
                'loaded_at': datetime.now().timestamp(),
                'last_used': datetime.now().timestamp(),
                'model_info': model_info
            }
            
            # Aktualizuj metadata
            self.model_metadata[model_id]['metadata']['last_used'] = datetime.now().isoformat()
            
            logger.info(f"Successfully loaded model: {model_info['name']}")
            return pipeline
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            raise
    
    async def load_lora(self, lora_id: str, pipeline: Any, weight: float = 1.0) -> Any:
        """Načte a aplikuje LoRA na pipeline"""
        lora_info = self.get_model_info(lora_id)
        if not lora_info:
            raise ValueError(f"LoRA {lora_id} not found")
        
        if lora_info['type'] != 'lora':
            raise ValueError(f"Model {lora_id} is not a LoRA")
        
        logger.info(f"Loading LoRA: {lora_info['name']} with weight {weight}")
        
        try:
            lora_path = lora_info['path']
            
            # Načti LoRA weights
            if lora_path.endswith('.safetensors'):
                lora_weights = load_file(lora_path)
            else:
                lora_weights = torch.load(lora_path, map_location=self.device)
            
            # Aplikuj LoRA na pipeline (zjednodušená implementace)
            # V produkci by zde byla komplexní LoRA aplikace
            pipeline.load_lora_weights(lora_path, weight_name="pytorch_lora_weights.safetensors")
            
            # Uložit do cache
            self.loaded_loras[lora_id] = {
                'weights': lora_weights,
                'loaded_at': datetime.now().timestamp(),
                'last_used': datetime.now().timestamp(),
                'lora_info': lora_info,
                'weight': weight
            }
            
            logger.info(f"Successfully loaded LoRA: {lora_info['name']}")
            return pipeline
            
        except Exception as e:
            logger.error(f"Failed to load LoRA {lora_id}: {e}")
            raise
    
    def get_memory_usage(self) -> Dict:
        """Vrátí informace o využití paměti"""
        memory_info = {
            "loaded_models": len(self.loaded_models),
            "loaded_loras": len(self.loaded_loras),
            "device": self.device
        }
        
        if torch.cuda.is_available():
            memory_info.update({
                "gpu_memory_allocated": torch.cuda.memory_allocated(),
                "gpu_memory_reserved": torch.cuda.memory_reserved(),
                "gpu_memory_allocated_mb": torch.cuda.memory_allocated() / 1024**2,
                "gpu_memory_reserved_mb": torch.cuda.memory_reserved() / 1024**2
            })
        
        return memory_info
    
    def cleanup(self):
        """Vyčistí všechny načtené modely z paměti"""
        logger.info("Cleaning up all loaded models...")
        self.loaded_models.clear()
        self.loaded_loras.clear()
        self._clear_gpu_memory()
        logger.info("Cleanup completed")

# Globální instance se vytváří v main.py pro vyřešení circular imports
