// Centralized in-memory job state for processing results
// Note: In-memory state persists per Node.js process (sufficient for single pod)

export type FrontendResult = {
  id: string
  imageUrl: string
  seed: number
  parameters: {
    strength: number
    cfgScale: number
    steps: number
    sampler: string
  }
  createdAt: number
  isFavorite?: boolean
}

type JobRecord = {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentStep?: string
  errorMessage?: string
  results?: FrontendResult[]
  createdAt: number
}

type ProcessingState = {
  jobs: Map<string, JobRecord>
}

let state: ProcessingState | null = null

export function getProcessingState(): ProcessingState {
  if (!state) {
    state = { jobs: new Map() }
  }
  return state
}


