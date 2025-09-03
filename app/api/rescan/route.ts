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
      models_found: 0, // prázdné - čeká na persist disk
      message: "Mock rescan completed - žádné modely nenalezeny, připojte persistent disk s modely",
      models: []
    })
  } catch (error) {
    console.error('Error in rescan API:', error)
    return NextResponse.json(
      { error: 'Rescan failed', details: String(error) },
      { status: 500 }
    )
  }
}
