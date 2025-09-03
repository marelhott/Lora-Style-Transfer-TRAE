import { NextResponse } from 'next/server'

// Prázdné pole - modely se načtou z persistent disku (/data/models a /data/loras)
const mockModels: any[] = []

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
