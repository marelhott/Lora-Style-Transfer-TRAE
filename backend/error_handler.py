#!/usr/bin/env python3
"""
Error Handler pro LoRA Style Transfer
Centralizované error handling a logging pro production
"""

import os
import sys
import traceback
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

import torch
from fastapi import HTTPException
from fastapi.responses import JSONResponse

# Setup logging
class ColoredFormatter(logging.Formatter):
    """Colored formatter pro lepší čitelnost logů"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)

def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None):
    """Nastaví logging pro aplikaci"""
    
    # Vytvoř logs adresář
    logs_dir = Path("/data/logs")
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    # Základní konfigurace
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Console handler s barvami
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColoredFormatter(log_format))
    
    # File handler
    if log_file is None:
        log_file = logs_dir / f"lora_transfer_{datetime.now().strftime('%Y%m%d')}.log"
    
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(logging.Formatter(log_format))
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    # Suppress některé verbose loggery
    logging.getLogger("transformers").setLevel(logging.WARNING)
    logging.getLogger("diffusers").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    return root_logger

class ErrorHandler:
    """Centralizovaný error handler"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.error_counts = {}
    
    def log_error(self, error: Exception, context: Dict[str, Any] = None) -> str:
        """Zaloguje chybu s kontextem"""
        error_id = f"ERR_{int(datetime.now().timestamp())}_{id(error)}"
        
        # Základní info o chybě
        error_info = {
            "error_id": error_id,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "timestamp": datetime.now().isoformat(),
            "context": context or {}
        }
        
        # Přidej system info
        error_info["system"] = self._get_system_info()
        
        # Traceback
        error_info["traceback"] = traceback.format_exc()
        
        # Počítadlo chyb
        error_type = type(error).__name__
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # Log podle závažnosti
        if isinstance(error, (FileNotFoundError, ValueError)):
            self.logger.warning(f"Error {error_id}: {error_info}")
        else:
            self.logger.error(f"Error {error_id}: {error_info}")
        
        return error_id
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Získá informace o systému"""
        info = {
            "python_version": sys.version,
            "platform": sys.platform
        }
        
        # GPU info
        if torch.cuda.is_available():
            try:
                info["gpu"] = {
                    "name": torch.cuda.get_device_name(),
                    "memory_total": torch.cuda.get_device_properties(0).total_memory,
                    "memory_allocated": torch.cuda.memory_allocated(),
                    "memory_reserved": torch.cuda.memory_reserved()
                }
            except Exception:
                info["gpu"] = "Error getting GPU info"
        else:
            info["gpu"] = "CUDA not available"
        
        return info
    
    def handle_model_error(self, error: Exception, model_id: str) -> HTTPException:
        """Zpracuje chyby související s modely"""
        error_id = self.log_error(error, {"model_id": model_id, "operation": "model_loading"})
        
        if isinstance(error, FileNotFoundError):
            return HTTPException(
                status_code=404,
                detail={
                    "error": "Model not found",
                    "model_id": model_id,
                    "error_id": error_id,
                    "suggestion": "Check if the model file exists in /data/models or /data/loras"
                }
            )
        elif isinstance(error, torch.cuda.OutOfMemoryError):
            return HTTPException(
                status_code=507,
                detail={
                    "error": "GPU out of memory",
                    "model_id": model_id,
                    "error_id": error_id,
                    "suggestion": "Try using a smaller model or reduce batch size"
                }
            )
        elif "safetensors" in str(error).lower():
            return HTTPException(
                status_code=422,
                detail={
                    "error": "Model file corrupted or incompatible",
                    "model_id": model_id,
                    "error_id": error_id,
                    "suggestion": "Re-download the model file or check its integrity"
                }
            )
        else:
            return HTTPException(
                status_code=500,
                detail={
                    "error": "Model loading failed",
                    "model_id": model_id,
                    "error_id": error_id,
                    "message": str(error)
                }
            )
    
    def handle_processing_error(self, error: Exception, job_id: str, parameters: Dict) -> HTTPException:
        """Zpracuje chyby při generování obrázků"""
        error_id = self.log_error(error, {
            "job_id": job_id,
            "operation": "image_processing",
            "parameters": parameters
        })
        
        if isinstance(error, torch.cuda.OutOfMemoryError):
            return HTTPException(
                status_code=507,
                detail={
                    "error": "GPU out of memory during processing",
                    "job_id": job_id,
                    "error_id": error_id,
                    "suggestion": "Reduce image size, steps, or batch count"
                }
            )
        elif "steps" in str(error).lower() and "must be" in str(error).lower():
            return HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid processing parameters",
                    "job_id": job_id,
                    "error_id": error_id,
                    "suggestion": "Check steps, CFG scale, and strength values"
                }
            )
        elif isinstance(error, ValueError):
            return HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid input parameters",
                    "job_id": job_id,
                    "error_id": error_id,
                    "message": str(error)
                }
            )
        else:
            return HTTPException(
                status_code=500,
                detail={
                    "error": "Image processing failed",
                    "job_id": job_id,
                    "error_id": error_id,
                    "message": str(error)
                }
            )
    
    def handle_generic_error(self, error: Exception, context: Dict = None) -> HTTPException:
        """Zpracuje obecné chyby"""
        error_id = self.log_error(error, context)
        
        return HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "error_id": error_id,
                "message": "An unexpected error occurred"
            }
        )
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Vrátí statistiky chyb"""
        return {
            "error_counts": self.error_counts,
            "total_errors": sum(self.error_counts.values()),
            "most_common_error": max(self.error_counts.items(), key=lambda x: x[1])[0] if self.error_counts else None
        }

# Global error handler instance
error_handler = ErrorHandler()

# Utility functions
def safe_execute(func, *args, **kwargs):
    """Bezpečně spustí funkci s error handlingem"""
    try:
        return func(*args, **kwargs)
    except Exception as e:
        error_handler.log_error(e, {
            "function": func.__name__,
            "args": str(args)[:200],  # Limit length
            "kwargs": str(kwargs)[:200]
        })
        raise

def validate_parameters(parameters: Dict) -> Dict[str, Any]:
    """Validuje a sanitizuje parametry"""
    validated = {}
    errors = []
    
    # Strength validation
    strength = parameters.get("strength", 0.7)
    if not isinstance(strength, (int, float)) or not 0.0 <= strength <= 1.0:
        errors.append("Strength must be between 0.0 and 1.0")
    else:
        validated["strength"] = float(strength)
    
    # CFG Scale validation
    cfg_scale = parameters.get("cfgScale", 7.5)
    if not isinstance(cfg_scale, (int, float)) or not 1.0 <= cfg_scale <= 30.0:
        errors.append("CFG Scale must be between 1.0 and 30.0")
    else:
        validated["cfgScale"] = float(cfg_scale)
    
    # Steps validation
    steps = parameters.get("steps", 20)
    if not isinstance(steps, int) or not 1 <= steps <= 150:
        errors.append("Steps must be between 1 and 150")
    else:
        validated["steps"] = int(steps)
    
    # Sampler validation
    valid_samplers = ["Euler a", "Euler", "LMS", "Heun", "DPM2", "DPM2 a", "DPM++ 2M"]
    sampler = parameters.get("sampler", "Euler a")
    if sampler not in valid_samplers:
        errors.append(f"Sampler must be one of: {', '.join(valid_samplers)}")
    else:
        validated["sampler"] = sampler
    
    # Seed validation
    seed = parameters.get("seed")
    if seed is not None:
        if not isinstance(seed, int) or not 0 <= seed <= 2**32 - 1:
            errors.append("Seed must be between 0 and 4294967295")
        else:
            validated["seed"] = int(seed)
    
    # Prompt validation
    prompt = parameters.get("prompt", "high quality, detailed, masterpiece")
    if not isinstance(prompt, str) or len(prompt) > 1000:
        errors.append("Prompt must be a string with max 1000 characters")
    else:
        validated["prompt"] = prompt.strip()
    
    # Negative prompt validation
    negative_prompt = parameters.get("negative_prompt", "low quality, blurry, artifacts")
    if not isinstance(negative_prompt, str) or len(negative_prompt) > 1000:
        errors.append("Negative prompt must be a string with max 1000 characters")
    else:
        validated["negative_prompt"] = negative_prompt.strip()
    
    if errors:
        raise ValueError(f"Parameter validation failed: {'; '.join(errors)}")
    
    return validated

def check_system_resources() -> Dict[str, Any]:
    """Zkontroluje dostupné systémové zdroje"""
    resources = {
        "status": "ok",
        "warnings": [],
        "errors": []
    }
    
    # GPU check
    if not torch.cuda.is_available():
        resources["errors"].append("CUDA not available")
        resources["status"] = "error"
    else:
        try:
            gpu_memory = torch.cuda.get_device_properties(0).total_memory
            allocated_memory = torch.cuda.memory_allocated()
            usage_percent = (allocated_memory / gpu_memory) * 100
            
            if usage_percent > 90:
                resources["errors"].append(f"GPU memory usage critical: {usage_percent:.1f}%")
                resources["status"] = "error"
            elif usage_percent > 75:
                resources["warnings"].append(f"GPU memory usage high: {usage_percent:.1f}%")
                if resources["status"] == "ok":
                    resources["status"] = "warning"
            
            resources["gpu_memory_usage"] = usage_percent
            
        except Exception as e:
            resources["errors"].append(f"GPU check failed: {str(e)}")
            resources["status"] = "error"
    
    # Disk space check
    try:
        import shutil
        total, used, free = shutil.disk_usage("/data")
        free_percent = (free / total) * 100
        
        if free_percent < 5:
            resources["errors"].append(f"Disk space critical: {free_percent:.1f}% free")
            resources["status"] = "error"
        elif free_percent < 15:
            resources["warnings"].append(f"Disk space low: {free_percent:.1f}% free")
            if resources["status"] == "ok":
                resources["status"] = "warning"
        
        resources["disk_free_percent"] = free_percent
        
    except Exception as e:
        resources["warnings"].append(f"Disk check failed: {str(e)}")
    
    return resources