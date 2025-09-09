import { NextRequest, NextResponse } from 'next/server'
import { getProcessingState } from '../../_processing/state'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params
    
    console.log('📊 Checking status for job:', jobId)
    
    const store = getProcessingState()
    const job = store.jobs.get(jobId)

    if (!job) {
      return NextResponse.json({
        job_id: jobId,
        status: 'failed',
        progress: 0,
        current_step: 'Job not found'
      })
    }

    // Convert results for frontend consumption (already in frontend format)
    return NextResponse.json({
      job_id: job.jobId,
      status: job.status,
      progress: job.progress,
      current_step: job.currentStep || null,
      results: job.results || [],
      error_message: job.errorMessage || null,
      completed_at: job.status === 'completed' ? new Date().toISOString() : null
    })
    
  } catch (error) {
    console.error('❌ Status check error:', error)
    return NextResponse.json(
      { error: 'Status check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
