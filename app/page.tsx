"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Settings, 
  Cpu, 
  Play,
  Download,
  AlertCircle
} from "lucide-react"

import { ImageUpload } from "@/components/image-upload"
import { ParameterControls, ProcessingParameters } from "@/components/parameter-controls"
import { ProgressTracker, ProcessingStatus } from "@/components/progress-tracker"
import { ModelManager, AIModel } from "@/components/model-manager"
import { ResultsGallery, GeneratedResult } from "@/components/results-gallery"

import { ErrorBoundary } from "@/components/error-boundary"

// Convex imports
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

// API endpoint - jednoduché relativní cesty
const getApiBaseUrl = () => {
  return '' // Next.js API routes
}

// API_BASE_URL se volá dynamicky v loadModels funkci

export default function Home() {
  // Convex queries and mutations
  const results = useQuery(api.results.getResults) || []
  const createResults = useMutation(api.results.createResults)
  const toggleResultFavorite = useMutation(api.results.toggleFavorite)

  // Preset management
  const presets = useQuery(api.presets.getPresets) || []
  const createPreset = useMutation(api.presets.createPreset)
  const updatePreset = useMutation(api.presets.updatePreset)
  const deletePreset = useMutation(api.presets.deletePreset)
  const togglePresetFavorite = useMutation(api.presets.toggleFavorite)

  // State management
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("pending")
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string>("")
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  
  const [parameters, setParameters] = useState<ProcessingParameters>({
    strength: 0.7,
    cfgScale: 7.5,
    steps: 20,
    clipSkip: 1,
    sampler: "Euler a",
    batchCount: 1,
    upscaleFactor: undefined
  })



  // Convert Convex results to frontend format
  const convertedResults: GeneratedResult[] = results.map(result => ({
    id: result._id,
    imageUrl: result.imageUrl,
    seed: result.seed,
    parameters: result.parameters,
    createdAt: result.createdAt,
    isFavorite: result.isFavorite
  }))



  const handleToggleResultFavorite = async (resultId: string) => {
    try {
      await toggleResultFavorite({ id: resultId as Id<"results"> })
    } catch (error) {
      console.error("Failed to toggle result favorite:", error)
    }
  }

  const handleDownload = (resultId: string) => {
    const result = convertedResults.find(r => r.id === resultId)
    if (result) {
      // Create download link
      const link = document.createElement('a')
      link.href = result.imageUrl
      link.download = `neural-art-${result.seed}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDownloadAll = () => {
    convertedResults.forEach((result, index) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = result.imageUrl
        link.download = `neural-art-batch-${index + 1}-${result.seed}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }, index * 500) // Stagger downloads
    })
  }

  const handleShare = async (resultId: string) => {
    const result = convertedResults.find(r => r.id === resultId)
    if (result && navigator.share) {
      try {
        await navigator.share({
          title: 'Neural Art Studio - Generovaný obrázek',
          text: `Podívej se na tento AI generovaný obrázek! Seed: ${result.seed}`,
          url: result.imageUrl
        })
      } catch (error) {
        // Fallback: copy to clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(result.imageUrl)
        }
      }
    } else if (result && navigator.clipboard) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(result.imageUrl)
    }
  }

  const handleImageUpload = (file: File, base64: string) => {
    setUploadedFile(file)
    const url = URL.createObjectURL(file)
    setUploadedImage(url)
  }

  const handleRemoveImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage)
    }
    setUploadedImage(null)
    setUploadedFile(null)
  }

  const canProcess = uploadedFile && selectedModelId && !isProcessing

  // Real AI processing function for RunPod backend
  const handleStartProcessing = async () => {
    if (!uploadedFile || !selectedModelId) return
    
    const selectedModel = models.find(m => m.id === selectedModelId)
    if (!selectedModel) return

    setIsProcessing(true)
    setProcessingStatus("initializing")
    setProgress(0)
    setCurrentStep("Preparing request...")
    setElapsedTime(0)
    setEstimatedTime(undefined)

    const startTime = Date.now()

    try {
      // Convert image to base64
      const formData = new FormData()
      formData.append('image', uploadedFile)
      formData.append('model_id', selectedModelId)
      formData.append('parameters', JSON.stringify(parameters))

      // Start processing job
      const response = await fetch(`${getApiBaseUrl()}/api/process`, {
        method: 'POST',
        body: formData,
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const { job_id } = await response.json()
      
      // Poll for status updates
      const pollStatus = async () => {
        const statusController = new AbortController()
        const statusTimeoutId = setTimeout(() => statusController.abort(), 10000)

        const statusResponse = await fetch(`${getApiBaseUrl()}/api/status/${job_id}`, {
          cache: 'no-store',
          signal: statusController.signal
        })

        clearTimeout(statusTimeoutId)
        const statusData = await statusResponse.json()
        
        setProcessingStatus(statusData.status)
        setCurrentStep(statusData.current_step || "Processing...")
        setProgress(statusData.progress || 0)
        setElapsedTime((Date.now() - startTime) / 1000)
        
        if (statusData.estimated_time_remaining) {
          setEstimatedTime(statusData.estimated_time_remaining)
        }
        
        if (statusData.status === 'completed') {
          // Save results to database
          try {
            const resultIds = await createResults({ results: statusData.results })
            if (resultIds.length > 0) {
              setSelectedResultId(resultIds[0])
            }
          } catch (error) {
            console.error("Failed to save results to database:", error)
          }
          setIsProcessing(false)
          return
        }
        
        if (statusData.status === 'failed') {
          throw new Error(statusData.error_message || 'Processing failed')
        }
        
        // Continue polling
        setTimeout(pollStatus, 2000)
      }
      
      // Start polling
      setTimeout(pollStatus, 1000)

    } catch (error) {
      console.error('Error during processing:', error)
      setProcessingStatus("failed")
      setCurrentStep(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsProcessing(false)
    }
  }


  // Scan disk using Next.js API
  const scanDisk = async () => {
    try {
      console.log("🔍 Scanning disk...")
      
      const response = await fetch('/api/scan-disk', { 
        method: 'POST',
        cache: 'no-store' 
      })
      
      if (response.ok) {
        const scanResult = await response.json()
        console.log("🔍 Disk Scan Result:", scanResult)
        
        if (scanResult.status === 'success') {
          console.log(`📊 Found ${scanResult.models_count} models, ${scanResult.loras_count} LoRAs`)
          console.log("📁 Models path:", scanResult.models_path)
          console.log("📁 LoRAs path:", scanResult.loras_path)
          
          // Reload modely pokud byly nalezeny
          if (scanResult.total_count > 0) {
            console.log("✅ Modely nalezeny, reloaduji...")
            setTimeout(() => loadModels(), 1000)
          }
        } else {
          console.error("❌ Scan failed:", scanResult.error)
        }
      } else {
        console.error("❌ Scan request failed:", response.status)
      }
    } catch (error) {
      console.error("❌ Disk scan failed:", error)
    }
  }

  // Load models from Next.js API route
  const loadModels = async () => {
    try {
      console.log('🔍 Loading models from Next.js API...')

      const res = await fetch('/api/models', {
        cache: 'no-store'
      })

      if (res.ok) {
        const data = await res.json()
        console.log('✅ Models loaded:', data.models?.length || 0)
        setModels(data.models || [])
      } else {
        console.error('❌ Failed to load models:', res.status)
        setModels([])
      }
    } catch (error) {
      console.error('❌ Failed to load models:', error)
      setModels([])
    }
  }

  useEffect(() => {
    console.log("🚀 Frontend component mounted")
    loadModels()
    
    
    // Reload models when backend URL changes
    const handleStorageChange = () => {
      loadModels()
    }
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Set selected result when results change
  useEffect(() => {
    if (convertedResults.length > 0 && !selectedResultId) {
      setSelectedResultId(convertedResults[0].id)
    }
  }, [convertedResults, selectedResultId])

  return (
    <div className="min-h-screen bg-background">
      {/* Main Layout */}
      <ErrorBoundary>
        <div className="w-full px-0 py-6">
          <div className="grid grid-cols-12 gap-4 min-h-[calc(100vh-140px)] w-full">
            
            {/* Left Sidebar - Parameters & Presets */}
            <div className="col-span-2 space-y-4 overflow-y-auto custom-scrollbar pl-4">
              <ErrorBoundary>
                <ParameterControls
                  parameters={parameters}
                  onParametersChange={setParameters}
                  presets={presets}
                  onSavePreset={async (name: string, params: ProcessingParameters) => {
                    try {
                      await createPreset({ name, parameters: params })
                    } catch (error) {
                      console.error("Failed to save preset:", error)
                    }
                  }}
                  onLoadPreset={(preset: any) => {
                    setParameters(preset.parameters)
                  }}
                  onDeletePreset={async (presetId: string) => {
                    try {
                      await deletePreset({ id: presetId as Id<"presets"> })
                    } catch (error) {
                      console.error("Failed to delete preset:", error)
                    }
                  }}
                  onTogglePresetFavorite={async (presetId: string) => {
                    try {
                      await togglePresetFavorite({ id: presetId as Id<"presets"> })
                    } catch (error) {
                      console.error("Failed to toggle preset favorite:", error)
                    }
                  }}
                />
              </ErrorBoundary>

            </div>

            {/* Center - Main Content */}
            <div className="col-span-7 space-y-4">
              
              {/* Processing Controls - moved above results */}
              <div className="flex space-x-4">
                <Button 
                  className="flex-1" 
                  size="lg"
                  disabled={!canProcess}
                  onClick={handleStartProcessing}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isProcessing ? "Zpracovávání..." : `Generovat ${parameters.batchCount} ${parameters.batchCount === 1 ? 'obrázek' : parameters.batchCount < 5 ? 'obrázky' : 'obrázků'}`}
                </Button>
                <Button variant="outline" size="lg" disabled={convertedResults.length === 0} onClick={handleDownloadAll}>
                  <Download className="w-4 h-4 mr-2" />
                  Stáhnout
                </Button>
              </div>

              {/* Progress Tracking - moved above results */}
              <ErrorBoundary>
                <ProgressTracker
                  status={processingStatus}
                  progress={progress}
                  currentStep={currentStep}
                  estimatedTimeRemaining={estimatedTime}
                  elapsedTime={elapsedTime}
                />
              </ErrorBoundary>

              {/* Results Gallery - increased height by 20% */}
              <div className="h-[480px]"> {/* Increased from h-96 (384px) to 480px */}
                <ErrorBoundary>
                  <ResultsGallery
                    results={convertedResults}
                    selectedResultId={selectedResultId}
                    onResultSelect={setSelectedResultId}
                    onDownload={handleDownload}
                    onDownloadAll={handleDownloadAll}
                    onToggleFavorite={handleToggleResultFavorite}
                    onShare={handleShare}
                  />
                </ErrorBoundary>
              </div>
            </div>

            {/* Right Sidebar - Models only */}
            <div className="col-span-3 space-y-4 overflow-y-auto custom-scrollbar pr-4">
              {/* Image Upload - moved to right sidebar */}
              <ErrorBoundary>
                <ImageUpload
                  onImageUpload={handleImageUpload}
                  uploadedImage={uploadedImage}
                  onRemoveImage={handleRemoveImage}
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <ModelManager
                  models={models}
                  selectedModelId={selectedModelId}
                  onModelSelect={setSelectedModelId}
                  onModelUpload={() => {
                    // Model upload není implementován kvůli bezpečnosti
                    // Modely se nahrávají přímo do /data/models/ přes RunPod interface
                  }}
                  onModelDelete={(id) => {
                    // Model deletion není implementován kvůli bezpečnosti
                    // Modely se mazají přímo v /data/models/ přes RunPod interface
                  }}
                  onScanDisk={scanDisk}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  )
}
