#!/usr/bin/env python3
"""
Memory Manager pro optimalizaci GPU a RAM paměti
Pokročilé cache a memory management pro RunPod
"""

import gc
import logging
import psutil
import time
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from threading import Lock
import weakref

import torch
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class MemoryStats:
    """Statistiky využití paměti"""
    gpu_allocated: int = 0
    gpu_reserved: int = 0
    gpu_free: int = 0
    gpu_total: int = 0
    ram_used: int = 0
    ram_available: int = 0
    ram_total: int = 0
    timestamp: float = 0.0

@dataclass
class CacheEntry:
    """Položka v cache"""
    key: str
    data: Any
    size_bytes: int
    last_accessed: float
    access_count: int
    priority: int = 1  # 1=low, 2=medium, 3=high

class MemoryManager:
    """Pokročilý správce paměti s cache optimalizacemi"""
    
    def __init__(self, 
                 max_gpu_memory_mb: int = 10240,  # 10GB default
                 max_ram_cache_mb: int = 4096,    # 4GB default
                 cleanup_threshold: float = 0.85,  # 85% threshold
                 aggressive_cleanup: bool = True):
        
        self.max_gpu_memory = max_gpu_memory_mb * 1024 * 1024
        self.max_ram_cache = max_ram_cache_mb * 1024 * 1024
        self.cleanup_threshold = cleanup_threshold
        self.aggressive_cleanup = aggressive_cleanup
        
        # Cache storage
        self.model_cache: Dict[str, CacheEntry] = {}
        self.tensor_cache: Dict[str, CacheEntry] = {}
        self.result_cache: Dict[str, CacheEntry] = {}
        
        # Locks pro thread safety
        self.cache_lock = Lock()
        self.memory_lock = Lock()
        
        # Statistiky
        self.cache_hits = 0
        self.cache_misses = 0
        self.cleanup_count = 0
        
        # Callbacks pro cleanup
        self.cleanup_callbacks: List[Callable] = []
        
        logger.info(f"MemoryManager initialized:")
        logger.info(f"  Max GPU Memory: {max_gpu_memory_mb}MB")
        logger.info(f"  Max RAM Cache: {max_ram_cache_mb}MB")
        logger.info(f"  Cleanup Threshold: {cleanup_threshold*100}%")
        
        # Počáteční cleanup
        self.cleanup_gpu_memory()
    
    def get_memory_stats(self) -> MemoryStats:
        """Získá aktuální statistiky paměti"""
        stats = MemoryStats(timestamp=time.time())
        
        # GPU statistiky
        if torch.cuda.is_available():
            stats.gpu_allocated = torch.cuda.memory_allocated()
            stats.gpu_reserved = torch.cuda.memory_reserved()
            
            # Celková GPU paměť
            gpu_props = torch.cuda.get_device_properties(0)
            stats.gpu_total = gpu_props.total_memory
            stats.gpu_free = stats.gpu_total - stats.gpu_reserved
        
        # RAM statistiky
        memory = psutil.virtual_memory()
        stats.ram_used = memory.used
        stats.ram_available = memory.available
        stats.ram_total = memory.total
        
        return stats
    
    def get_gpu_utilization(self) -> float:
        """Vrátí využití GPU paměti v procentech"""
        if not torch.cuda.is_available():
            return 0.0
        
        allocated = torch.cuda.memory_allocated()
        total = torch.cuda.get_device_properties(0).total_memory
        return (allocated / total) * 100
    
    def get_ram_utilization(self) -> float:
        """Vrátí využití RAM v procentech"""
        memory = psutil.virtual_memory()
        return memory.percent
    
    def should_cleanup(self) -> bool:
        """Zkontroluje, zda je potřeba cleanup"""
        gpu_util = self.get_gpu_utilization() / 100
        ram_util = self.get_ram_utilization() / 100
        
        return (gpu_util > self.cleanup_threshold or 
                ram_util > self.cleanup_threshold)
    
    def cleanup_gpu_memory(self, force: bool = False):
        """Vyčistí GPU paměť"""
        with self.memory_lock:
            if force or self.should_cleanup():
                logger.info("Cleaning up GPU memory...")
                
                # Spusť cleanup callbacks
                for callback in self.cleanup_callbacks:
                    try:
                        callback()
                    except Exception as e:
                        logger.warning(f"Cleanup callback failed: {e}")
                
                # PyTorch cleanup
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                
                # Python garbage collection
                gc.collect()
                
                self.cleanup_count += 1
                logger.debug(f"GPU memory cleanup completed (#{self.cleanup_count})")
    
    def register_cleanup_callback(self, callback: Callable):
        """Registruje callback pro cleanup"""
        self.cleanup_callbacks.append(callback)
    
    def cache_model(self, key: str, model: Any, priority: int = 2) -> bool:
        """Uloží model do cache"""
        try:
            with self.cache_lock:
                # Odhad velikosti modelu
                size_bytes = self._estimate_model_size(model)
                
                # Zkontroluj dostupnou paměť
                if self._check_cache_space(size_bytes):
                    entry = CacheEntry(
                        key=key,
                        data=weakref.ref(model),  # Weak reference
                        size_bytes=size_bytes,
                        last_accessed=time.time(),
                        access_count=1,
                        priority=priority
                    )
                    
                    self.model_cache[key] = entry
                    logger.debug(f"Cached model {key} ({size_bytes/1024/1024:.1f}MB)")
                    return True
                else:
                    logger.warning(f"Not enough cache space for model {key}")
                    return False
        
        except Exception as e:
            logger.error(f"Failed to cache model {key}: {e}")
            return False
    
    def get_cached_model(self, key: str) -> Optional[Any]:
        """Získá model z cache"""
        with self.cache_lock:
            if key in self.model_cache:
                entry = self.model_cache[key]
                
                # Zkontroluj weak reference
                model = entry.data()
                if model is not None:
                    # Aktualizuj statistiky
                    entry.last_accessed = time.time()
                    entry.access_count += 1
                    self.cache_hits += 1
                    
                    logger.debug(f"Cache hit for model {key}")
                    return model
                else:
                    # Model byl garbage collected
                    del self.model_cache[key]
                    logger.debug(f"Model {key} was garbage collected")
            
            self.cache_misses += 1
            return None
    
    def cache_tensor(self, key: str, tensor: torch.Tensor, priority: int = 1) -> bool:
        """Uloží tensor do cache"""
        try:
            with self.cache_lock:
                size_bytes = tensor.numel() * tensor.element_size()
                
                if self._check_cache_space(size_bytes):
                    entry = CacheEntry(
                        key=key,
                        data=tensor.clone().detach(),
                        size_bytes=size_bytes,
                        last_accessed=time.time(),
                        access_count=1,
                        priority=priority
                    )
                    
                    self.tensor_cache[key] = entry
                    logger.debug(f"Cached tensor {key} ({size_bytes/1024/1024:.1f}MB)")
                    return True
                else:
                    return False
        
        except Exception as e:
            logger.error(f"Failed to cache tensor {key}: {e}")
            return False
    
    def get_cached_tensor(self, key: str) -> Optional[torch.Tensor]:
        """Získá tensor z cache"""
        with self.cache_lock:
            if key in self.tensor_cache:
                entry = self.tensor_cache[key]
                entry.last_accessed = time.time()
                entry.access_count += 1
                self.cache_hits += 1
                
                return entry.data.clone().detach()
            
            self.cache_misses += 1
            return None
    
    def _estimate_model_size(self, model: Any) -> int:
        """Odhadne velikost modelu v bytech"""
        try:
            if hasattr(model, 'parameters'):
                # PyTorch model
                total_size = 0
                for param in model.parameters():
                    total_size += param.numel() * param.element_size()
                return total_size
            
            elif hasattr(model, '__sizeof__'):
                return model.__sizeof__()
            
            else:
                # Fallback odhad
                return 1024 * 1024 * 100  # 100MB default
        
        except Exception:
            return 1024 * 1024 * 100  # 100MB fallback
    
    def _check_cache_space(self, required_bytes: int) -> bool:
        """Zkontroluje dostupný prostor v cache"""
        current_size = sum(entry.size_bytes for entry in self.model_cache.values())
        current_size += sum(entry.size_bytes for entry in self.tensor_cache.values())
        
        if current_size + required_bytes > self.max_ram_cache:
            # Pokus o cleanup cache
            self._cleanup_cache(required_bytes)
            
            # Znovu zkontroluj
            current_size = sum(entry.size_bytes for entry in self.model_cache.values())
            current_size += sum(entry.size_bytes for entry in self.tensor_cache.values())
            
            return current_size + required_bytes <= self.max_ram_cache
        
        return True
    
    def _cleanup_cache(self, required_bytes: int = 0):
        """Vyčistí cache podle LRU a priority"""
        logger.info("Cleaning up cache...")
        
        # Kombinuj všechny cache entries
        all_entries = []
        
        for key, entry in self.model_cache.items():
            all_entries.append((key, entry, 'model'))
        
        for key, entry in self.tensor_cache.items():
            all_entries.append((key, entry, 'tensor'))
        
        # Seřaď podle priority (nižší = smaž dříve) a last_accessed
        all_entries.sort(key=lambda x: (x[1].priority, x[1].last_accessed))
        
        freed_bytes = 0
        target_bytes = required_bytes if required_bytes > 0 else self.max_ram_cache // 4
        
        for key, entry, cache_type in all_entries:
            if freed_bytes >= target_bytes:
                break
            
            # Smaž entry
            if cache_type == 'model':
                del self.model_cache[key]
            else:
                del self.tensor_cache[key]
            
            freed_bytes += entry.size_bytes
            logger.debug(f"Removed {cache_type} {key} from cache ({entry.size_bytes/1024/1024:.1f}MB)")
        
        logger.info(f"Cache cleanup freed {freed_bytes/1024/1024:.1f}MB")
    
    def clear_cache(self, cache_type: str = 'all'):
        """Vyčistí cache"""
        with self.cache_lock:
            if cache_type in ['all', 'models']:
                self.model_cache.clear()
                logger.info("Cleared model cache")
            
            if cache_type in ['all', 'tensors']:
                self.tensor_cache.clear()
                logger.info("Cleared tensor cache")
            
            if cache_type in ['all', 'results']:
                self.result_cache.clear()
                logger.info("Cleared result cache")
    
    def get_cache_stats(self) -> Dict:
        """Vrátí statistiky cache"""
        with self.cache_lock:
            model_size = sum(entry.size_bytes for entry in self.model_cache.values())
            tensor_size = sum(entry.size_bytes for entry in self.tensor_cache.values())
            result_size = sum(entry.size_bytes for entry in self.result_cache.values())
            
            total_size = model_size + tensor_size + result_size
            hit_rate = self.cache_hits / (self.cache_hits + self.cache_misses) if (self.cache_hits + self.cache_misses) > 0 else 0
            
            return {
                "model_cache_entries": len(self.model_cache),
                "tensor_cache_entries": len(self.tensor_cache),
                "result_cache_entries": len(self.result_cache),
                "model_cache_size_mb": model_size / 1024 / 1024,
                "tensor_cache_size_mb": tensor_size / 1024 / 1024,
                "result_cache_size_mb": result_size / 1024 / 1024,
                "total_cache_size_mb": total_size / 1024 / 1024,
                "max_cache_size_mb": self.max_ram_cache / 1024 / 1024,
                "cache_utilization": (total_size / self.max_ram_cache) * 100,
                "cache_hit_rate": hit_rate * 100,
                "cache_hits": self.cache_hits,
                "cache_misses": self.cache_misses,
                "cleanup_count": self.cleanup_count
            }
    
    def optimize_memory(self):
        """Spustí kompletní optimalizaci paměti"""
        logger.info("Starting memory optimization...")
        
        # 1. Cleanup GPU
        self.cleanup_gpu_memory(force=True)
        
        # 2. Cleanup cache pokud je potřeba
        if self.should_cleanup():
            self._cleanup_cache()
        
        # 3. Defragmentace (pokud možné)
        if torch.cuda.is_available():
            try:
                torch.cuda.memory._dump_snapshot("memory_snapshot.pickle")
                logger.debug("Memory snapshot saved")
            except Exception:
                pass
        
        # 4. Statistiky po optimalizaci
        stats = self.get_memory_stats()
        cache_stats = self.get_cache_stats()
        
        logger.info(f"Memory optimization completed:")
        logger.info(f"  GPU: {stats.gpu_allocated/1024/1024:.1f}MB / {stats.gpu_total/1024/1024:.1f}MB")
        logger.info(f"  RAM: {stats.ram_used/1024/1024:.1f}MB / {stats.ram_total/1024/1024:.1f}MB")
        logger.info(f"  Cache: {cache_stats['total_cache_size_mb']:.1f}MB / {cache_stats['max_cache_size_mb']:.1f}MB")
    
    def __del__(self):
        """Cleanup při destrukci"""
        try:
            self.clear_cache()
            self.cleanup_gpu_memory(force=True)
        except Exception:
            pass

# Globální instance
memory_manager = MemoryManager()