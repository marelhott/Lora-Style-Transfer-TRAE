import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    const debug_info = {
      mode: "frontend_mock",
      message: "Running in frontend-only mode with mock data",
      models_path: "/data/models",
      loras_path: "/data/loras", 
      models_path_exists: existsSync("/data/models"),
      loras_path_exists: existsSync("/data/loras"),
      current_working_dir: process.cwd(),
      model_metadata_count: 5, // mock count
      available_models: 5, // mock count
      backend_status: "mock_mode"
    }

    // Zkus prozkoumat /data pokud existuje
    if (existsSync("/data")) {
      try {
        const dataContents = await readdir("/data")
        debug_info.data_directory_contents = dataContents
      } catch (e) {
        debug_info.data_scan_error = `Error reading /data: ${e}`
      }
    }

    // Zkus prozkoumat /data/models pokud existuje
    if (existsSync("/data/models")) {
      try {
        const modelsContents = await readdir("/data/models")
        debug_info.models_directory_contents = modelsContents.slice(0, 10) // max 10
      } catch (e) {
        debug_info.models_scan_error = `Error reading /data/models: ${e}`
      }
    }

    // Zkus prozkoumat /data/loras pokud existuje
    if (existsSync("/data/loras")) {
      try {
        const lorasContents = await readdir("/data/loras") 
        debug_info.loras_directory_contents = lorasContents.slice(0, 10) // max 10
      } catch (e) {
        debug_info.loras_scan_error = `Error reading /data/loras: ${e}`
      }
    }

    return NextResponse.json(debug_info)
  } catch (error) {
    console.error('Error in debug API:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    )
  }
}
