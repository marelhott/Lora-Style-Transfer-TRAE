import { NextResponse } from 'next/server'

// Mock data pro testování když Python backend není dostupný
const mockModels = [
  {
    id: "full_realistic_vision_v5",
    name: "Realistic Vision v5.0",
    type: "full",
    fileSize: 2147483648, // 2GB
    uploadedAt: Date.now() - 86400000, // včera
    isActive: true,
    metadata: {
      description: "Realistic Vision v5.0 - vysoká kvalita realistických obrázků",
      category: "realistic",
      format: "safetensors",
      tags: ["realistic", "portraits", "photography"]
    }
  },
  {
    id: "full_deliberate_v2",
    name: "Deliberate v2",
    type: "full", 
    fileSize: 2048576000, // ~1.9GB
    uploadedAt: Date.now() - 172800000, // před 2 dny
    isActive: true,
    metadata: {
      description: "Deliberate v2 - univerzální model pro různé styly",
      category: "general",
      format: "safetensors",
      tags: ["versatile", "anime", "realistic"]
    }
  },
  {
    id: "lora_fantasy_style",
    name: "Fantasy Art Style",
    type: "lora",
    fileSize: 144048576, // ~137MB
    uploadedAt: Date.now() - 259200000, // před 3 dny
    isActive: true,
    metadata: {
      description: "LoRA pro fantasy umělecký styl",
      category: "fantasy",
      format: "safetensors", 
      tags: ["fantasy", "art", "magical"]
    }
  },
  {
    id: "lora_cyberpunk_2077",
    name: "Cyberpunk 2077 Style",
    type: "lora",
    fileSize: 156238592, // ~149MB
    uploadedAt: Date.now() - 345600000, // před 4 dny
    isActive: true,
    metadata: {
      description: "LoRA styl inspirovaný Cyberpunk 2077",
      category: "cyberpunk",
      format: "safetensors",
      tags: ["cyberpunk", "futuristic", "neon"]
    }
  },
  {
    id: "lora_studio_ghibli",
    name: "Studio Ghibli Style",
    type: "lora", 
    fileSize: 128974848, // ~123MB
    uploadedAt: Date.now() - 432000000, // před 5 dny
    isActive: true,
    metadata: {
      description: "LoRA ve stylu Studio Ghibli filmů",
      category: "anime",
      format: "safetensors",
      tags: ["ghibli", "anime", "artistic"]
    }
  }
]

export async function GET() {
  try {
    // Simulace mírného zpoždění jako skutečný API
    await new Promise(resolve => setTimeout(resolve, 200))
    
    return NextResponse.json(mockModels)
  } catch (error) {
    console.error('Error in models API:', error)
    return NextResponse.json(
      { error: 'Failed to load models' },
      { status: 500 }
    )
  }
}

export async function HEAD() {
  // HEAD request pro testování dostupnosti
  return new NextResponse(null, { status: 200 })
}
