"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
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
import { DebugConsole } from "@/components/debug-console"

import { ErrorBoundary } from "@/components/error-boundary"

// API endpoint - jednoduché relativní cesty
const getApiBaseUrl = () => {
  return '' // Next.js API routes
}

export default function Home() {
  // Local state management (replacing Convex)
  const [results, setResults] = useState<GeneratedResult[]>([])
  const [presets, setPresets] = useState<any[]>([])
  
  // Load data from localStorage on mount
  useEffect(() => {
    const savedResults = localStorage.getItem('ai-results')
    const savedPresets = localStorage.getItem('ai-presets')
    if (savedResults) setResults(JSON.parse(savedResults))
    if (savedPresets) setPresets(JSON.parse(savedPresets))
  }, [])
  
  // Helper functions for local storage
  const saveResults = (newResults: GeneratedResult[]) => {
    setResults(newResults)
    localStorage.setItem('ai-results', JSON.stringify(newResults))
  }
  
  const savePresets = (newPresets: any[]) => {
    setPresets(newPresets)
    localStorage.setItem('ai-presets', JSON.stringify(newPresets))
  }

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
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localResults, setLocalResults] = useState<GeneratedResult[]>([])
  const [debugEntries, setDebugEntries] = useState<{ t: number, level: 'info' | 'warn' | 'error', msg: string }[]>([])
  
  const [versionInfo, setVersionInfo] = useState<any>(null)
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
    id: result.id,
    imageUrl: result.imageUrl,
    seed: result.seed,
    parameters: result.parameters,
    createdAt: result.createdAt,
    isFavorite: result.isFavorite
  }))

  // Prefer locally generated results first (fallback when Convex save fails)
  const displayedResults: GeneratedResult[] = [
    ...localResults,
    ...convertedResults
  ]



  const handleToggleResultFavorite = async (resultId: string) => {
    try {
      const updatedResults = results.map(result => 
        result.id === resultId 
          ? { ...result, isFavorite: !result.isFavorite }
          : result
      )
      saveResults(updatedResults)
    } catch (error) {
      console.error("Failed to toggle result favorite:", error)
    }
  }

  const handleDownload = (resultId: string) => {
    const result = displayedResults.find(r => r.id === resultId)
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
    displayedResults.forEach((result, index) => {
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
    setDebugEntries(prev => [...prev, { t: Date.now(), level: 'info', msg: `Obrázek nahrán: ${file.name} (${file.size} B)` }])
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
    setDebugEntries(prev => [...prev, { t: Date.now(), level: 'info', msg: `Start zpracování | model=${selectedModelId} | size=${uploadedFile.size}` }])
    setProgress(5)
    setCurrentStep("Preparing request...")
    setElapsedTime(0)
    setEstimatedTime(undefined)

    // Smooth progress animation up to 85%
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
    }
    progressTimerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + 2
        return next >= 85 ? 85 : next
      })
    }, 200)

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
        setDebugEntries(prev => [...prev, { t: Date.now(), level: 'error', msg: `Process HTTP ${response.status}` }])
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const startData = await response.json()
      const job_id = startData.job_id
      setDebugEntries(prev => [...prev, { t: Date.now(), level: 'info', msg: `Job ID: ${job_id}` }])

      // If API already returned results, show them immediately (skip polling)
      if (startData.result || startData.results) {
        const incoming = Array.isArray(startData.results)
          ? startData.results
          : [startData.result]
        if (incoming && incoming.length > 0) {
          setLocalResults(prev => [...incoming, ...prev])
          setSelectedResultId(incoming[0].id)
          setProcessingStatus('completed')
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current)
            progressTimerRef.current = null
          }
          setProgress(100)
          setCurrentStep('Processing complete')
          setIsProcessing(false)
          setDebugEntries(prev => [...prev, { t: Date.now(), level: 'info', msg: `Immediate results: ${incoming.length}` }])
          return
        }
      }
      
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
        setDebugEntries(prev => [...prev, { t: Date.now(), level: 'info', msg: `Status=${statusData.status} | progress=${statusData.progress || 0}` }])
        
        setProcessingStatus(statusData.status)
        setCurrentStep(statusData.current_step || "Processing...")
        if (typeof statusData.progress === 'number') {
          setProgress(p => Math.max(p, statusData.progress))
        }
        setElapsedTime((Date.now() - startTime) / 1000)
        
        if (statusData.estimated_time_remaining) {
          setEstimatedTime(statusData.estimated_time_remaining)
        }
        
        if (statusData.status === 'completed') {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current)
            progressTimerRef.current = null
          }
          setProgress(100)
          // Save results to local storage
          if (statusData.results && statusData.results.length > 0) {
            const newResults = statusData.results.map((result: any, index: number) => ({
              ...result,
              id: `result_${Date.now()}_${index}`,
              timestamp: new Date().toISOString(),
              isFavorite: false
            }))
            saveResults([...results, ...newResults])
            setSelectedResultId(newResults[0].id)
          }
          setIsProcessing(false)
          setDebugEntries(prev => [...prev, { t: Date.now(), level: 'info', msg: `Dokončeno s ${statusData.results?.length || 0} výsledky` }])
          return
        }
        
        if (statusData.status === 'failed') {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current)
            progressTimerRef.current = null
          }
          setDebugEntries(prev => [...prev, { t: Date.now(), level: 'error', msg: `Chyba: ${statusData.error_message || 'Processing failed'}` }])
          throw new Error(statusData.error_message || 'Processing failed')
        }
        
        // Continue polling
        setTimeout(pollStatus, 2000)
      }
      
      // Start polling with a hard timeout fallback
      const maxPollingMs = 25000
      const timeoutId = setTimeout(() => {
        setProcessingStatus('failed')
        setCurrentStep('Timeout: processing took too long')
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current)
          progressTimerRef.current = null
        }
        setIsProcessing(false)
        setDebugEntries(prev => [...prev, { t: Date.now(), level: 'warn', msg: 'Timeout exceed 25s' }])
      }, maxPollingMs)

      const startPoll = async () => {
        await pollStatus()
        clearTimeout(timeoutId)
      }
      setTimeout(startPoll, 1000)

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

  // Load version info
  const loadVersionInfo = async () => {
    try {
      const res = await fetch('/', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setVersionInfo(data)
      }
    } catch (error) {
      console.error('Failed to load version info:', error)
    }
  }

  useEffect(() => {
    console.log("🚀 Frontend component mounted")
    loadModels()
    loadVersionInfo()
    
    // Reload models when backend URL changes
    const handleStorageChange = () => {
      loadModels()
    }
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
    }
  }, [])

  // Set selected result when results change (prefer local)
  useEffect(() => {
    if (displayedResults.length > 0 && !selectedResultId) {
      setSelectedResultId(displayedResults[0].id)
    }
  }, [displayedResults, selectedResultId])

  return (
    <div className="min-h-screen bg-background">
      {/* Version Info Banner */}
      {versionInfo && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">✅ {versionInfo.message}</p>
              <p className="text-sm">Verze: {versionInfo.version} | Build: {versionInfo.build_date}</p>
              {versionInfo.features && (
                <p className="text-xs mt-1">Funkce: {versionInfo.features.join(', ')}</p>
              )}
            </div>
            <span className="bg-green-50 px-2 py-1 rounded text-xs font-mono">
               {versionInfo.branch || 'trae-ai'}
             </span>
          </div>
        </div>
      )}
      
      {/* Main Layout */}
      <ErrorBoundary>
        <>
        <div className="w-full px-0 py-6">
          <div className="grid grid-cols-12 gap-4 min-h-[calc(100vh-140px)] w-full">
            
            {/* Left Sidebar - Parameters & Presets */}
            <div className="col-span-2 space-y-4 overflow-y-auto custom-scrollbar pl-4">
              <ErrorBoundary>
                <>
                <ParameterControls
                  parameters={parameters}
                  onParametersChange={setParameters}
                  presets={presets}
                  onSavePreset={async (name: string, params: ProcessingParameters) => {
                    try {
                      const newPreset = {
                        id: `preset_${Date.now()}`,
                        name,
                        parameters: params,
                        isFavorite: false,
                        createdAt: new Date().toISOString()
                      }
                      savePresets([...presets, newPreset])
                    } catch (error) {
                      console.error("Failed to save preset:", error)
                    }
                  }}
                  onLoadPreset={(preset: any) => {
                    setParameters(preset.parameters)
                  }}
                  onDeletePreset={async (presetId: string) => {
                    try {
                      const updatedPresets = presets.filter(preset => preset.id !== presetId)
                      savePresets(updatedPresets)
                    } catch (error) {
                      console.error("Failed to delete preset:", error)
                    }
                  }}
                  onTogglePresetFavorite={async (presetId: string) => {
                    try {
                      const updatedPresets = presets.map(preset => 
                        preset.id === presetId 
                          ? { ...preset, isFavorite: !preset.isFavorite }
                          : preset
                      )
                      savePresets(updatedPresets)
                    } catch (error) {
                      console.error("Failed to toggle preset favorite:", error)
                    }
                  }}
                />
                </>
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
                <>
                <ProgressTracker
                  status={processingStatus}
                  progress={progress}
                  currentStep={currentStep}
                  estimatedTimeRemaining={estimatedTime}
                  elapsedTime={elapsedTime}
                />
                </>
              </ErrorBoundary>

              {/* Results Gallery - increased height by 20% */}
              <div className="h-[480px]"> {/* Increased from h-96 (384px) to 480px */}
                <ErrorBoundary>
                  <>
                  <ResultsGallery
                    results={displayedResults}
                    selectedResultId={selectedResultId}
                    onResultSelect={setSelectedResultId}
                    onDownload={handleDownload}
                    onDownloadAll={handleDownloadAll}
                    onToggleFavorite={handleToggleResultFavorite}
                    onShare={handleShare}
                  />
                  </>
                </ErrorBoundary>
              </div>
            </div>

            {/* Right Sidebar - Models only */}
            <div className="col-span-3 space-y-4 overflow-y-auto custom-scrollbar pr-4">
              {/* Image Upload - moved to right sidebar */}
              <ErrorBoundary>
                <>
                <ImageUpload
                  onImageUpload={handleImageUpload}
                  uploadedImage={uploadedImage}
                  onRemoveImage={handleRemoveImage}
                />
                </>
              </ErrorBoundary>

              <ErrorBoundary>
                <>
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
                </>
              </ErrorBoundary>
            </div>

            {/* Diagnostics */}
            <div>
              <ErrorBoundary>
                <>
                <DebugConsole
                  entries={debugEntries}
                  onClear={() => setDebugEntries([])}
                />
                </>
              </ErrorBoundary>
            </div>
          </div>
        </div>
        </>
      </ErrorBoundary>
    </div>
  )
}
