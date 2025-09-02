
"use client"

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
import { BackendSettings } from "@/components/backend-settings"

import { ErrorBoundary } from "@/components/error-boundary"

// Convex imports
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

// API endpoint for RunPod backend
// Automatická detekce prostředí
const getApiBaseUrl = () => {
  console.log('🔧 getApiBaseUrl() called')
  
  // 1. Environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    console.log('🔧 Using env variable:', process.env.NEXT_PUBLIC_API_URL)
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // 2. Saved URL from Backend Settings
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('backend_url')
    if (savedUrl) {
      console.log('🔧 Using saved URL:', savedUrl)
      return savedUrl
    }
    
    // 3. RunPod auto-detection
    const hostname = window.location.hostname
    console.log('🔧 Current hostname:', hostname)
    
    if (hostname.includes('proxy.runpod.net')) {
      // Simple pattern: replace -3000 with -8000, or add -8000 if no port
      const apiHost = hostname.includes('-3000') 
        ? hostname.replace('-3000', '-8000')
        : hostname.replace('.proxy.runpod.net', '-8000.proxy.runpod.net')
      const apiUrl = `https://${apiHost}`
      console.log('🔧 RunPod detected, API URL:', apiUrl)
      return apiUrl
    }
  }
  
  // 4. Localhost fallback
  console.log('🔧 Using localhost fallback')
  return 'http://localhost:8000'
}

// API_BASE_URL se volá dynamicky v loadModels funkci

export default function Home() {
  // Convex queries and mutations
  const results = useQuery(api.results.getResults) || []
  const createResults = useMutation(api.results.createResults)
  const toggleResultFavorite = useMutation(api.results.toggleFavorite)

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
        console.log('Share failed:', error)
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(result.imageUrl)
        alert('Odkaz na obrázek zkopírován do schránky!')
      }
    } else if (result) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(result.imageUrl)
      alert('Odkaz na obrázek zkopírován do schránky!')
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
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const { job_id } = await response.json()
      
      // Poll for status updates
      const pollStatus = async () => {
        const statusResponse = await fetch(`${getApiBaseUrl()}/api/status/${job_id}`)
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

  // Load models from API
  const loadModels = async () => {
    try {
      // Použij aktuální API_BASE_URL (který už obsahuje správnou logiku)
      const apiUrl = getApiBaseUrl()
      console.log('🔍 Loading models from:', apiUrl)
      console.log('🌐 Current window.location:', typeof window !== 'undefined' ? window.location.href : 'SSR')
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error('⏰ Fetch timeout after 10s')
        controller.abort()
      }, 10000)
      
      const response = await fetch(`${apiUrl}/api/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      console.log('📡 Response status:', response.status)
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (response.ok) {
        const modelsData = await response.json()
        console.log('✅ Loaded models:', modelsData.length)
        setModels(modelsData)
      } else {
        const errorText = await response.text()
        console.error('❌ Failed to load models: HTTP', response.status, errorText)
        setModels([]) // Vyčisti modely při chybě
      }
    } catch (error) {
      console.error('💥 Failed to load models:', error)
      console.error('💥 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      setModels([]) // Vyčisti modely při chybě
    }
  }

  useEffect(() => {
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
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-140px)]">
            
            {/* Left Sidebar - Parameters & Presets */}
            <div className="col-span-3 space-y-4 overflow-y-auto custom-scrollbar">
              <ErrorBoundary>
                <ParameterControls
                  parameters={parameters}
                  onParametersChange={setParameters}
                  onSavePreset={() => console.log("Uložit předvolbu")}
                  onLoadPreset={() => console.log("Načíst předvolbu")}
                />
              </ErrorBoundary>

            </div>

            {/* Center - Main Content */}
            <div className="col-span-6 space-y-4">
              
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
            <div className="col-span-3 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Backend Settings */}
              <ErrorBoundary>
                <BackendSettings />
              </ErrorBoundary>

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
                  onModelUpload={() => alert("Model upload feature coming soon in full version!")}
                  onModelDelete={(id) => alert("Model deletion feature coming soon in full version!")}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  )
}
