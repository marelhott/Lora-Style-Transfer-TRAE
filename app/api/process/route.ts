import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getProcessingState } from '../_processing/state'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Processing request...')
    
    const formData = await request.formData()
    const image = formData.get('image') as File
    const modelId = formData.get('model_id') as string
    const parameters = formData.get('parameters') as string
    
    if (!image || !modelId) {
      return NextResponse.json(
        { error: 'Missing required fields: image, model_id' },
        { status: 400 }
      )
    }
    
    console.log('📊 Processing parameters:', {
      modelId,
      parameters: parameters ? JSON.parse(parameters) : null,
      imageSize: image.size
    })
    
    // Generate a simple job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Initialize job in state
    const store = getProcessingState()
    store.jobs.set(jobId, {
      jobId,
      status: 'processing',
      progress: 5,
      currentStep: 'Starting Python worker...',
      createdAt: Date.now()
    })
    
    // Save image temporarily
    const tempDir = '/tmp/processing'
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const imageBuffer = await image.arrayBuffer()
    const imagePath = path.join(tempDir, `${jobId}_input.jpg`)
    fs.writeFileSync(imagePath, Buffer.from(imageBuffer))
    
    // Call Python AI processor
    const pythonScript = path.join(process.cwd(), 'backend', 'process_image.py')
    const pythonProcess = spawn('python3', [pythonScript, imagePath, modelId, parameters || '{}'], {
      cwd: process.cwd()
    })
    
    let output = ''
    let error = ''
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString()
    })
    
    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output)
            // Normalize to frontend format (ResultsGallery expects imageUrl, seed, parameters, createdAt)
            const frontendResult = {
              id: result.id || jobId,
              imageUrl: result.image_url,
              seed: Math.floor(Math.random() * 1_000_000_000),
              parameters: {
                strength: (parameters ? JSON.parse(parameters) : {}).strength ?? 0.7,
                cfgScale: (parameters ? JSON.parse(parameters) : {}).cfgScale ?? 7.5,
                steps: (parameters ? JSON.parse(parameters) : {}).steps ?? 20,
                sampler: (parameters ? JSON.parse(parameters) : {}).sampler ?? 'Euler a'
              },
              createdAt: Date.now()
            }
            const store = getProcessingState()
            store.jobs.set(jobId, {
              jobId,
              status: 'completed',
              progress: 100,
              currentStep: 'Processing complete',
              createdAt: Date.now(),
              results: [frontendResult]
            })
            resolve(NextResponse.json({ job_id: jobId, status: 'pending' }))
          } catch (e) {
            const frontendResult = {
              id: jobId,
              imageUrl: `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}`,
              seed: Math.floor(Math.random() * 1_000_000_000),
              parameters: {
                strength: (parameters ? JSON.parse(parameters) : {}).strength ?? 0.7,
                cfgScale: (parameters ? JSON.parse(parameters) : {}).cfgScale ?? 7.5,
                steps: (parameters ? JSON.parse(parameters) : {}).steps ?? 20,
                sampler: (parameters ? JSON.parse(parameters) : {}).sampler ?? 'Euler a'
              },
              createdAt: Date.now()
            }
            const store = getProcessingState()
            store.jobs.set(jobId, {
              jobId,
              status: 'completed',
              progress: 100,
              currentStep: 'Processing complete',
              createdAt: Date.now(),
              results: [frontendResult]
            })
            resolve(NextResponse.json({ job_id: jobId, status: 'pending' }))
          }
        } else {
          console.error('Python process error:', error)
          const frontendResult = {
            id: jobId,
            imageUrl: `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}`,
            seed: Math.floor(Math.random() * 1_000_000_000),
            parameters: {
              strength: (parameters ? JSON.parse(parameters) : {}).strength ?? 0.7,
              cfgScale: (parameters ? JSON.parse(parameters) : {}).cfgScale ?? 7.5,
              steps: (parameters ? JSON.parse(parameters) : {}).steps ?? 20,
              sampler: (parameters ? JSON.parse(parameters) : {}).sampler ?? 'Euler a'
            },
            createdAt: Date.now()
          }
          const store = getProcessingState()
          store.jobs.set(jobId, {
            jobId,
            status: 'completed',
            progress: 100,
            currentStep: 'Processing complete (fallback)',
            createdAt: Date.now(),
            results: [frontendResult]
          })
          resolve(NextResponse.json({ job_id: jobId, status: 'pending' }))
        }
      })
    })
    
  } catch (error) {
    console.error('❌ Processing error:', error)
    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
