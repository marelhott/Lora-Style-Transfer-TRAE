#!/usr/bin/env python3
"""
Model Manager pro LoRA Style Transfer
Spravuje načítání, cache a optimalizaci AI modelů
"""

import os
import json
import hashlib
import gc
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import logging
from datetime import datetime

import torch
from diffusers import (
    StableDiffusionImg2ImgPipeline,
    StableDiffusionPipeline,
    DiffusionPipeline
)
from safetensors.torch import load_file
import psutil

logger = logging.getLogger(__name__)

class ModelInfo:
    """Informace o modelu"""
    
    def __init__(self, path: Path):
        self.path = path
        self.id = path.stem
        self.name = path.stem
        self.format = path.suffix[1:]  # bez tečky
        self.type = "lora" if "lora" in str(path).lower() else "full"
        
        # Získej metadata souboru
        stat = path.stat()
        self.size = stat.st_size
        self.modified = stat.st_mtime
        
        # Hash pro cache invalidation
        self.hash = self._calculate_hash()
        
        # Model metadata (načte se lazy)
        self._metadata = None
        self._is_loaded = False
    
    def _calculate_hash(self) -> str:
        """Vypočítá hash souboru pro cache invalidation"""
        hasher = hashlib.md5()
        hasher.update(str(self.path).encode())
        hasher.update(str(self.size).encode())
        hasher.update(str(self.modified).encode())
        return hasher.hexdigest()[:16]
    
    def get_metadata(self) -> Dict:
        """Získá metadata modelu (lazy loading)"""
        if self._metadata is None:
            self._metadata = self._load_metadata()
        return self._metadata
    
    def _load_metadata(self) -> Dict:
        """Načte metadata z modelu"""
        metadata = {
            "id": self.id,
            "name": self.name,
            "path": str(self.path),
            "type": self.type,
            "format": self.format,
            "size": self.size,
            "modified": self.modified,
            "hash": self.hash
        }
        
        try:
            if self.format == "safetensors":
                # Pro safetensors můžeme načíst metadata bez načtení celého modelu
                from safetensors import safe_open
                with safe_open(self.path, framework="pt") as f:
                    if hasattr(f, 'metadata'):
                        metadata["safetensors_metadata"] = f.metadata()
            
            # Detekce typu modelu podle velikosti
            if self.type == "full":
                if self.size > 6 * 1024**3:  # > 6GB
                    metadata["model_type"] = "SDXL"
                elif self.size > 3 * 1024**3:  # > 3GB
                    metadata["model_type"] = "SD 2.x"
                else:
                    metadata["model_type"] = "SD 1.5"
            
        except Exception as e:
            logger.warning(f"Failed to load metadata for {self.path}: {e}")
            metadata["metadata_error"] = str(e)
        
        return metadata
    
    def to_dict(self) -> Dict:
        """Převede na dictionary pro API"""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "fileSize": self.size,
            "uploadedAt": int(self.modified * 1000),  # milliseconds
            "path": str(self.path),
            "format": self.format,
            "hash": self.hash
        }

class ModelCache:
    """Cache pro načtené modely"""
    
    def __init__(self, max_memory_gb: float = 8.0):
        self.max_memory_bytes = int(max_memory_gb * 1024**3)
        self.cache: Dict[str, Tuple[Any, float, int]] = {}  # model_id -> (pipeline, timestamp, memory_usage)
        self.current_memory = 0
    
    def get(self, model_id: str) -> Optional[Any]:
        """Získá model z cache"""
        if model_id in self.cache:
            pipeline, _, memory = self.cache[model_id]
            # Update timestamp
            self.cache[model_id] = (pipeline, datetime.now().timestamp(), memory)
            logger.info(f"Model {model_id} loaded from cache")
            return pipeline
        return None
    
    def put(self, model_id: str, pipeline: Any, memory_usage: int):
        """Uloží model do cache"""
        # Vyčisti cache pokud je potřeba
        while self.current_memory + memory_usage > self.max_memory_bytes and self.cache:
            self._evict_oldest()
        
        self.cache[model_id] = (pipeline, datetime.now().timestamp(), memory_usage)
        self.current_memory += memory_usage
        logger.info(f"Model {model_id} cached ({memory_usage / 1024**2:.1f}MB)")
    
    def _evict_oldest(self):
        """Vyhodí nejstarší model z cache"""
        if not self.cache:
            return
        
        oldest_id = min(self.cache.keys(), key=lambda k: self.cache[k][1])
        pipeline, _, memory = self.cache.pop(oldest_id)
        self.current_memory -= memory
        
        # Vyčisti z GPU paměti
        del pipeline
        torch.cuda.empty_cache()
        gc.collect()
        
        logger.info(f"Evicted model {oldest_id} from cache")
    
    def clear(self):
        """Vyčistí celou cache"""
        for model_id, (pipeline, _, _) in self.cache.items():
            del pipeline
        
        self.cache.clear()
        self.current_memory = 0
        torch.cuda.empty_cache()
        gc.collect()
        logger.info("Model cache cleared")
    
    def get_stats(self) -> Dict:
        """Vrátí statistiky cache"""
        return {
            "cached_models": len(self.cache),
            "memory_used_mb": self.current_memory / 1024**2,
            "memory_limit_mb": self.max_memory_bytes / 1024**2,
            "memory_usage_percent": (self.current_memory / self.max_memory_bytes) * 100,
            "models": list(self.cache.keys())
        }

class ModelManager:
    """Správce modelů pro LoRA Style Transfer"""
    
    def __init__(self, models_path: str = "/data/models", loras_path: str = "/data/loras"):
        self.models_path = Path(models_path)
        self.loras_path = Path(loras_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Vytvoř adresáře pokud neexistují
        self.models_path.mkdir(parents=True, exist_ok=True)
        self.loras_path.mkdir(parents=True, exist_ok=True)
        
        # Model cache
        available_memory = self._get_available_gpu_memory()
        cache_memory = min(available_memory * 0.6, 8.0)  # Max 60% GPU paměti nebo 8GB
        self.cache = ModelCache(max_memory_gb=cache_memory)
        
        # Model registry
        self._models: Dict[str, ModelInfo] = {}
        self._loras: Dict[str, ModelInfo] = {}
        
        logger.info(f"ModelManager initialized")
        logger.info(f"Models path: {self.models_path}")
        logger.info(f"LoRAs path: {self.loras_path}")
        logger.info(f"Cache memory limit: {cache_memory:.1f}GB")
        
        # Načti modely
        self.scan_models()
    
    def _get_available_gpu_memory(self) -> float:
        """Získá dostupnou GPU paměť v GB"""
        if not torch.cuda.is_available():
            return 4.0  # Fallback pro CPU
        
        try:
            total_memory = torch.cuda.get_device_properties(0).total_memory
            return total_memory / 1024**3
        except Exception:
            return 8.0  # Fallback
    
    def scan_models(self) -> Tuple[int, int]:
        """Skenuje adresáře pro modely a LoRA"""
        logger.info("Scanning for models...")
        
        # Vyčisti registry
        self._models.clear()
        self._loras.clear()
        
        # Skenuj full modely
        model_extensions = [".safetensors", ".ckpt", ".pt", ".pth"]
        for ext in model_extensions:
            for model_path in self.models_path.glob(f"*{ext}"):
                if model_path.is_file():
                    model_info = ModelInfo(model_path)
                    self._models[model_info.id] = model_info
        
        # Skenuj LoRA modely
        lora_extensions = [".safetensors", ".pt"]
        for ext in lora_extensions:
            for lora_path in self.loras_path.glob(f"*{ext}"):
                if lora_path.is_file():
                    lora_info = ModelInfo(lora_path)
                    lora_info.type = "lora"  # Force type
                    self._loras[lora_info.id] = lora_info
        
        models_count = len(self._models)
        loras_count = len(self._loras)
        
        logger.info(f"Found {models_count} models, {loras_count} LoRAs")
        return models_count, loras_count
    
    def get_models(self) -> List[Dict]:
        """Vrátí seznam všech modelů"""
        return [model.to_dict() for model in self._models.values()]
    
    def get_loras(self) -> List[Dict]:
        """Vrátí seznam všech LoRA modelů"""
        return [lora.to_dict() for lora in self._loras.values()]
    
    def get_model_info(self, model_id: str) -> Optional[ModelInfo]:
        """Získá informace o modelu"""
        return self._models.get(model_id) or self._loras.get(model_id)
    
    def load_model(self, model_id: str) -> StableDiffusionImg2ImgPipeline:
        """Načte model a vrátí pipeline"""
        # Zkus cache
        cached_pipeline = self.cache.get(model_id)
        if cached_pipeline is not None:
            return cached_pipeline
        
        # Najdi model
        model_info = self.get_model_info(model_id)
        if not model_info:
            raise FileNotFoundError(f"Model {model_id} not found")
        
        if model_info.type != "full":
            raise ValueError(f"Model {model_id} is not a full model (type: {model_info.type})")
        
        logger.info(f"Loading model: {model_id} from {model_info.path}")
        
        try:
            # Měření paměti před načtením
            memory_before = torch.cuda.memory_allocated() if torch.cuda.is_available() else 0
            
            # Načti pipeline podle formátu
            if model_info.format == "safetensors":
                pipeline = StableDiffusionImg2ImgPipeline.from_single_file(
                    str(model_info.path),
                    torch_dtype=torch.float16,
                    use_safetensors=True,
                    load_safety_checker=False,
                    requires_safety_checker=False
                )
            else:
                pipeline = StableDiffusionImg2ImgPipeline.from_single_file(
                    str(model_info.path),
                    torch_dtype=torch.float16,
                    load_safety_checker=False,
                    requires_safety_checker=False
                )
            
            # Přesuň na GPU
            pipeline = pipeline.to(self.device)
            
            # Optimalizace
            self._optimize_pipeline(pipeline)
            
            # Měření paměti po načtení
            memory_after = torch.cuda.memory_allocated() if torch.cuda.is_available() else 0
            memory_used = memory_after - memory_before
            
            # Uložení do cache
            self.cache.put(model_id, pipeline, memory_used)
            
            logger.info(f"Model {model_id} loaded successfully ({memory_used / 1024**2:.1f}MB)")
            return pipeline
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            raise e
    
    def _optimize_pipeline(self, pipeline: StableDiffusionImg2ImgPipeline):
        """Aplikuje optimalizace na pipeline"""
        try:
            # Memory optimizations
            if hasattr(pipeline, "enable_model_cpu_offload"):
                pipeline.enable_model_cpu_offload()
                logger.debug("CPU offload enabled")
            
            if hasattr(pipeline, "enable_attention_slicing"):
                pipeline.enable_attention_slicing()
                logger.debug("Attention slicing enabled")
            
            if hasattr(pipeline, "enable_xformers_memory_efficient_attention"):
                try:
                    pipeline.enable_xformers_memory_efficient_attention()
                    logger.debug("XFormers optimization enabled")
                except Exception as e:
                    logger.warning(f"XFormers not available: {e}")
            
            # VAE slicing pro velké obrázky
            if hasattr(pipeline, "enable_vae_slicing"):
                pipeline.enable_vae_slicing()
                logger.debug("VAE slicing enabled")
                
        except Exception as e:
            logger.warning(f"Some optimizations failed: {e}")
    
    def unload_model(self, model_id: str):
        """Vyhodí model z paměti"""
        if model_id in self.cache.cache:
            pipeline, _, memory = self.cache.cache.pop(model_id)
            self.cache.current_memory -= memory
            del pipeline
            torch.cuda.empty_cache()
            gc.collect()
            logger.info(f"Model {model_id} unloaded")
    
    def get_stats(self) -> Dict:
        """Vrátí statistiky model manageru"""
        stats = {
            "models_count": len(self._models),
            "loras_count": len(self._loras),
            "cache_stats": self.cache.get_stats(),
            "device": self.device
        }
        
        if torch.cuda.is_available():
            stats["gpu_stats"] = {
                "name": torch.cuda.get_device_name(),
                "memory_allocated_mb": torch.cuda.memory_allocated() / 1024**2,
                "memory_reserved_mb": torch.cuda.memory_reserved() / 1024**2,
                "memory_total_mb": torch.cuda.get_device_properties(0).total_memory / 1024**2
            }
        
        # System memory
        memory = psutil.virtual_memory()
        stats["system_memory"] = {
            "total_gb": memory.total / 1024**3,
            "available_gb": memory.available / 1024**3,
            "used_percent": memory.percent
        }
        
        return stats
    
    def cleanup(self):
        """Vyčistí všechny zdroje"""
        logger.info("Cleaning up ModelManager...")
        self.cache.clear()
        self._models.clear()
        self._loras.clear()
        logger.info("ModelManager cleanup completed")