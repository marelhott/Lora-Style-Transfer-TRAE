#!/usr/bin/env python3
"""
LoRA System pro pokročilé načítání a aplikaci LoRA modelů
Optimalizováno pro RunPod GPU s memory management
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import re

import torch
import torch.nn as nn
from safetensors.torch import load_file
import numpy as np
from diffusers import StableDiffusionPipeline
from diffusers.models.attention_processor import LoRAAttnProcessor
from diffusers.loaders import AttnProcsLayers

logger = logging.getLogger(__name__)

class LoRAManager:
    """Pokročilý správce LoRA modelů s optimalizacemi"""
    
    def __init__(self, loras_path: str = "/data/loras"):
        self.loras_path = Path(loras_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Cache pro načtené LoRA
        self.loaded_loras: Dict[str, Dict] = {}
        self.lora_metadata: Dict[str, Dict] = {}
        
        # Konfigurace
        self.max_loras_in_memory = 5
        self.default_lora_weight = 1.0
        
        logger.info(f"LoRAManager initialized with path: {self.loras_path}")
        self._scan_loras()
    
    def _scan_loras(self):
        """Naskenuje dostupné LoRA modely"""
        logger.info("Scanning LoRA models...")
        
        if not self.loras_path.exists():
            logger.warning(f"LoRA path {self.loras_path} does not exist")
            return
        
        for lora_file in self.loras_path.rglob("*.safetensors"):
            if lora_file.is_file():
                self._register_lora(lora_file)
        
        # Také hledej .pt soubory
        for lora_file in self.loras_path.rglob("*.pt"):
            if lora_file.is_file():
                self._register_lora(lora_file)
        
        logger.info(f"Found {len(self.lora_metadata)} LoRA models")
    
    def _register_lora(self, lora_path: Path):
        """Registruje LoRA model"""
        try:
            stat = lora_path.stat()
            lora_id = f"lora_{lora_path.stem}"
            
            # Pokus o načtení metadat z LoRA souboru
            metadata = self._extract_lora_metadata(lora_path)
            
            self.lora_metadata[lora_id] = {
                "id": lora_id,
                "name": lora_path.stem,
                "type": "lora",
                "path": str(lora_path),
                "fileSize": stat.st_size,
                "uploadedAt": int(stat.st_mtime * 1000),
                "isActive": True,
                "metadata": {
                    "description": f"LoRA model: {lora_path.stem}",
                    "category": "lora",
                    "format": lora_path.suffix[1:],
                    "rank": metadata.get("rank", "unknown"),
                    "alpha": metadata.get("alpha", "unknown"),
                    "target_modules": metadata.get("target_modules", []),
                    "last_used": None
                }
            }
            
            logger.debug(f"Registered LoRA: {lora_path.stem}")
            
        except Exception as e:
            logger.error(f"Failed to register LoRA {lora_path}: {e}")
    
    def _extract_lora_metadata(self, lora_path: Path) -> Dict:
        """Extrahuje metadata z LoRA souboru"""
        metadata = {}
        
        try:
            if lora_path.suffix == '.safetensors':
                # Načti safetensors metadata
                import safetensors
                with safetensors.safe_open(str(lora_path), framework="pt") as f:
                    # Pokus o získání metadat z hlavičky
                    if hasattr(f, 'metadata'):
                        raw_metadata = f.metadata()
                        if raw_metadata:
                            metadata.update(raw_metadata)
                    
                    # Analyzuj tensor názvy pro určení rank a target modules
                    tensor_names = list(f.keys())
                    metadata.update(self._analyze_tensor_structure(tensor_names))
            
            elif lora_path.suffix == '.pt':
                # Načti PyTorch metadata
                checkpoint = torch.load(str(lora_path), map_location='cpu')
                if isinstance(checkpoint, dict):
                    if 'metadata' in checkpoint:
                        metadata.update(checkpoint['metadata'])
                    
                    # Analyzuj strukturu
                    tensor_names = list(checkpoint.keys())
                    metadata.update(self._analyze_tensor_structure(tensor_names))
        
        except Exception as e:
            logger.warning(f"Could not extract metadata from {lora_path}: {e}")
        
        return metadata
    
    def _analyze_tensor_structure(self, tensor_names: List[str]) -> Dict:
        """Analyzuje strukturu tensorů pro určení LoRA parametrů"""
        analysis = {
            "rank": "unknown",
            "alpha": "unknown",
            "target_modules": []
        }
        
        try:
            # Hledej LoRA tensory (obvykle končí na .lora_up.weight, .lora_down.weight)
            lora_tensors = [name for name in tensor_names if '.lora_' in name]
            
            if lora_tensors:
                # Extrahuj target modules
                modules = set()
                for tensor_name in lora_tensors:
                    # Extrahuj název modulu před .lora_
                    match = re.search(r'(.+)\.lora_', tensor_name)
                    if match:
                        module_name = match.group(1)
                        # Zjednodušený název modulu
                        simplified = module_name.split('.')[-1]
                        modules.add(simplified)
                
                analysis["target_modules"] = list(modules)
                
                # Pokus o určení rank z velikosti tensorů
                # Toto je zjednodušená heuristika
                up_tensors = [name for name in lora_tensors if '.lora_up.' in name]
                if up_tensors:
                    analysis["rank"] = f"estimated_{len(up_tensors)}"
        
        except Exception as e:
            logger.warning(f"Could not analyze tensor structure: {e}")
        
        return analysis
    
    def get_available_loras(self) -> List[Dict]:
        """Vrátí seznam dostupných LoRA modelů"""
        return list(self.lora_metadata.values())
    
    def get_lora_info(self, lora_id: str) -> Optional[Dict]:
        """Vrátí informace o konkrétní LoRA"""
        return self.lora_metadata.get(lora_id)
    
    def _unload_oldest_lora(self):
        """Uvolní nejstarší LoRA z paměti"""
        if not self.loaded_loras:
            return
        
        oldest_lora = min(
            self.loaded_loras.keys(),
            key=lambda x: self.loaded_loras[x].get('last_used', 0)
        )
        
        logger.info(f"Unloading oldest LoRA: {oldest_lora}")
        del self.loaded_loras[oldest_lora]
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    async def load_lora_weights(self, lora_id: str) -> Dict[str, torch.Tensor]:
        """Načte LoRA weights do paměti"""
        if lora_id in self.loaded_loras:
            self.loaded_loras[lora_id]['last_used'] = torch.cuda.Event().record()
            logger.debug(f"LoRA {lora_id} already loaded")
            return self.loaded_loras[lora_id]['weights']
        
        lora_info = self.get_lora_info(lora_id)
        if not lora_info:
            raise ValueError(f"LoRA {lora_id} not found")
        
        # Zkontroluj paměť
        if len(self.loaded_loras) >= self.max_loras_in_memory:
            self._unload_oldest_lora()
        
        logger.info(f"Loading LoRA weights: {lora_info['name']}")
        
        try:
            lora_path = lora_info['path']
            
            # Načti weights podle formátu
            if lora_path.endswith('.safetensors'):
                weights = load_file(lora_path, device=self.device)
            elif lora_path.endswith('.pt'):
                checkpoint = torch.load(lora_path, map_location=self.device)
                if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
                    weights = checkpoint['state_dict']
                else:
                    weights = checkpoint
            else:
                raise ValueError(f"Unsupported LoRA format: {lora_path}")
            
            # Uložit do cache
            self.loaded_loras[lora_id] = {
                'weights': weights,
                'loaded_at': torch.cuda.Event().record() if torch.cuda.is_available() else 0,
                'last_used': torch.cuda.Event().record() if torch.cuda.is_available() else 0,
                'lora_info': lora_info
            }
            
            logger.info(f"Successfully loaded LoRA: {lora_info['name']}")
            return weights
            
        except Exception as e:
            logger.error(f"Failed to load LoRA {lora_id}: {e}")
            raise
    
    async def apply_lora_to_pipeline(
        self, 
        pipeline: StableDiffusionPipeline, 
        lora_id: str, 
        weight: float = 1.0
    ) -> StableDiffusionPipeline:
        """Aplikuje LoRA na Stable Diffusion pipeline"""
        
        logger.info(f"Applying LoRA {lora_id} with weight {weight}")
        
        try:
            # Načti LoRA weights
            lora_weights = await self.load_lora_weights(lora_id)
            
            # Moderní způsob aplikace LoRA pomocí diffusers
            lora_path = self.get_lora_info(lora_id)['path']
            
            # Použij built-in LoRA loading z diffusers
            pipeline.load_lora_weights(lora_path)
            
            # Nastav váhu LoRA
            pipeline.fuse_lora(lora_scale=weight)
            
            logger.info(f"Successfully applied LoRA {lora_id} with weight {weight}")
            return pipeline
            
        except Exception as e:
            logger.error(f"Failed to apply LoRA {lora_id}: {e}")
            # Pokus o fallback metodu
            return await self._apply_lora_manual(pipeline, lora_id, weight)
    
    async def _apply_lora_manual(
        self, 
        pipeline: StableDiffusionPipeline, 
        lora_id: str, 
        weight: float = 1.0
    ) -> StableDiffusionPipeline:
        """Manuální aplikace LoRA (fallback metoda)"""
        
        logger.info(f"Using manual LoRA application for {lora_id}")
        
        try:
            lora_weights = await self.load_lora_weights(lora_id)
            
            # Aplikuj LoRA weights na UNet
            unet = pipeline.unet
            
            # Toto je zjednodušená implementace
            # V produkci by zde byla komplexní LoRA aplikace
            for name, param in unet.named_parameters():
                # Hledej odpovídající LoRA weights
                lora_up_key = f"{name}.lora_up.weight"
                lora_down_key = f"{name}.lora_down.weight"
                
                if lora_up_key in lora_weights and lora_down_key in lora_weights:
                    lora_up = lora_weights[lora_up_key]
                    lora_down = lora_weights[lora_down_key]
                    
                    # Aplikuj LoRA: W = W + weight * (lora_up @ lora_down)
                    with torch.no_grad():
                        delta_weight = weight * torch.mm(lora_up, lora_down)
                        param.data += delta_weight
            
            logger.info(f"Manually applied LoRA {lora_id}")
            return pipeline
            
        except Exception as e:
            logger.error(f"Manual LoRA application failed for {lora_id}: {e}")
            raise
    
    def remove_lora_from_pipeline(self, pipeline: StableDiffusionPipeline) -> StableDiffusionPipeline:
        """Odstraní LoRA z pipeline"""
        try:
            # Použij built-in unfuse metodu
            pipeline.unfuse_lora()
            logger.info("Successfully removed LoRA from pipeline")
            return pipeline
        except Exception as e:
            logger.warning(f"Could not remove LoRA cleanly: {e}")
            return pipeline
    
    def get_memory_usage(self) -> Dict:
        """Vrátí informace o využití paměti LoRA"""
        memory_info = {
            "loaded_loras": len(self.loaded_loras),
            "available_loras": len(self.lora_metadata),
            "device": self.device
        }
        
        if self.loaded_loras:
            total_size = 0
            for lora_data in self.loaded_loras.values():
                weights = lora_data['weights']
                for tensor in weights.values():
                    if isinstance(tensor, torch.Tensor):
                        total_size += tensor.numel() * tensor.element_size()
            
            memory_info["lora_memory_bytes"] = total_size
            memory_info["lora_memory_mb"] = total_size / (1024 * 1024)
        
        return memory_info
    
    def cleanup(self):
        """Vyčistí všechny načtené LoRA z paměti"""
        logger.info("Cleaning up all loaded LoRAs...")
        self.loaded_loras.clear()
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("LoRA cleanup completed")

# Globální instance
lora_manager = LoRAManager()