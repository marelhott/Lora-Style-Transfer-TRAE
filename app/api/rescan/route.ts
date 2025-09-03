import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Simulace rescanu v mock mode
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return NextResponse.json({
      success: true,
      mode: "mock_rescan",
      models_path: "/data/models",
      loras_path: "/data/loras", 
      models_found: 5, // mock počet
      message: "Mock rescan completed - 5 models found",
      models: [
        { id: "full_realistic_vision_v5", type: "full" },
        { id: "full_deliberate_v2", type: "full" },
        { id: "lora_fantasy_style", type: "lora" },
        { id: "lora_cyberpunk_2077", type: "lora" },
        { id: "lora_studio_ghibli", type: "lora" }
      ]
    })
  } catch (error) {
    console.error('Error in rescan API:', error)
    return NextResponse.json(
      { error: 'Rescan failed', details: String(error) },
      { status: 500 }
    )
  }
}
