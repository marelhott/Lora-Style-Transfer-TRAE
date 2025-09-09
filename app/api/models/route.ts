import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Loading models from filesystem...')
    
    const MODELS_PATH = '/data/models'
    const LORAS_PATH = '/data/loras'
    
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
            path: filePath
          })
        }
      })
    }
    
    const allModels = [...models, ...loras]
    
    console.log(`✅ Found ${models.length} full models, ${loras.length} LoRAs`)
    
    return NextResponse.json({
      models: allModels,
      models_count: models.length,
      loras_count: loras.length,
      total_count: allModels.length
    })
    
  } catch (error) {
    console.error('❌ Error loading models:', error)
    return NextResponse.json(
      { error: 'Failed to load models', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}