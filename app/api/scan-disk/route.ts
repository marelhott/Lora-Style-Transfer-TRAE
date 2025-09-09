import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Scanning disk for models...')
    
    const MODELS_PATH = '/data/models'
    const LORAS_PATH = '/data/loras'
    
    // Ensure directories exist
    if (!fs.existsSync(MODELS_PATH)) {
      fs.mkdirSync(MODELS_PATH, { recursive: true })
    }
    if (!fs.existsSync(LORAS_PATH)) {
      fs.mkdirSync(LORAS_PATH, { recursive: true })
    }
    
    const models: any[] = []
    const loras: any[] = []
    
    // Scan full models
    if (fs.existsSync(MODELS_PATH)) {
      const files = fs.readdirSync(MODELS_PATH)
      files.forEach(file => {
        if (file.endsWith('.safetensors') || file.endsWith('.ckpt') || file.endsWith('.pt') || file.endsWith('.pth')) {
          const filePath = path.join(MODELS_PATH, file)
          const stats = fs.statSync(filePath)
          models.push({
            id: file.replace(/\.[^/.]+$/, ""),
            name: file.replace(/\.[^/.]+$/, ""),
            type: 'full',
            fileSize: stats.size,
            uploadedAt: stats.mtime.getTime(),
            isActive: false,
            path: filePath
          })
        }
      })
    }
    
    // Scan LoRA models
    if (fs.existsSync(LORAS_PATH)) {
      const files = fs.readdirSync(LORAS_PATH)
      files.forEach(file => {
        if (file.endsWith('.safetensors') || file.endsWith('.pt')) {
          const filePath = path.join(LORAS_PATH, file)
          const stats = fs.statSync(filePath)
          loras.push({
            id: file.replace(/\.[^/.]+$/, ""),
            name: file.replace(/\.[^/.]+$/, ""),
            type: 'lora',
            fileSize: stats.size,
            uploadedAt: stats.mtime.getTime(),
            isActive: false,
            path: filePath
          })
        }
      })
    }
    
    const allModels = [...models, ...loras]
    
    console.log(`✅ Scan complete: ${models.length} full models, ${loras.length} LoRAs`)
    
    return NextResponse.json({
      status: 'success',
      models: allModels,
      models_count: models.length,
      loras_count: loras.length,
      total_count: allModels.length,
      models_path: MODELS_PATH,
      loras_path: LORAS_PATH
    })
    
  } catch (error) {
    console.error('❌ Error scanning disk:', error)
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Failed to scan disk', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
