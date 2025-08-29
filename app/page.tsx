
"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Settings, 
  Cpu, 
  Palette,
  Play,
  Download,
  AlertCircle
} from "lucide-react"
import Image from "next/image"

import { ImageUpload } from "@/components/image-upload"
import { ParameterControls, ProcessingParameters } from "@/components/parameter-controls"
import { ProgressTracker, ProcessingStatus } from "@/components/progress-tracker"
import { ModelManager, AIModel } from "@/components/model-manager"
import { ResultsGallery, GeneratedResult } from "@/components/results-gallery"
import { PresetManager, Preset } from "@/components/preset-manager"
import { ErrorBoundary } from "@/components/error-boundary"

// Convex imports
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

// Mock data for demo purposes
const mockModels: AIModel[] = [
  // Demo models for testing - will be replaced when backend is integrated
  {
    id: "demo_model_1",
    name: "Artistic Style v1.0",
    type: "full",
    fileSize: 2147483648, // 2GB
    uploadedAt: Date.now() - 86400000, // 1 day ago
    isActive: true,
    metadata: {
      description: "Univerzální model pro umělecké stylové převody",
      category: "artistic"
    }
  },
  {
    id: "demo_model_2", 
    name: "Portrait Enhancer",
    type: "lora",
    fileSize: 134217728, // 128MB
    uploadedAt: Date.now() - 172800000, // 2 days ago
    isActive: true,
    metadata: {
      description: "Specializovaný LoRA model pro vylepšení portrétů",
      category: "portrait"
    }
  },
  {
    id: "demo_model_3",
    name: "Landscape Master",
    type: "full", 
    fileSize: 1073741824, // 1GB
    uploadedAt: Date.now() - 259200000, // 3 days ago
    isActive: true,
    metadata: {
      description: "Model optimalizovaný pro krajinné fotografie",
      category: "landscape"
    }
  }
]

export default function Home() {
  // Convex queries and mutations
  const presets = useQuery(api.presets.getPresets) || []
  const results = useQuery(api.results.getResults) || []
  const createPreset = useMutation(api.presets.createPreset)
  const deletePreset = useMutation(api.presets.deletePreset)
  const togglePresetFavorite = useMutation(api.presets.toggleFavorite)
  const createResults = useMutation(api.results.createResults)
  const toggleResultFavorite = useMutation(api.results.toggleFavorite)

  // State management
  const [models] = useState<AIModel[]>(mockModels)
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

  // Convert Convex presets to frontend format
  const convertedPresets: Preset[] = presets.map(preset => ({
    id: preset._id,
    name: preset.name,
    parameters: preset.parameters,
    isFavorite: preset.isFavorite,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt
  }))

  // Convert Convex results to frontend format
  const convertedResults: GeneratedResult[] = results.map(result => ({
    id: result._id,
    imageUrl: result.imageUrl,
    seed: result.seed,
    parameters: result.parameters,
    createdAt: result.createdAt,
    isFavorite: result.isFavorite
  }))

  const handleLoadPreset = (preset: Preset) => {
    setParameters(preset.parameters)
  }

  const handleSavePreset = async (name: string, params: ProcessingParameters) => {
    try {
      await createPreset({
        name,
        parameters: params
      })
    } catch (error) {
      console.error("Failed to save preset:", error)
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    try {
      await deletePreset({ id: presetId as Id<"presets"> })
    } catch (error) {
      console.error("Failed to delete preset:", error)
    }
  }

  const handleTogglePresetFavorite = async (presetId: string) => {
    try {
      await togglePresetFavorite({ id: presetId as Id<"presets"> })
    } catch (error) {
      console.error("Failed to toggle preset favorite:", error)
    }
  }

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

  // Mock processing function for demo
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
      // Simulate processing steps
      const steps = [
        { status: "loading_model" as ProcessingStatus, step: "Loading AI model...", progress: 0.1, duration: 2000 },
        { status: "generating" as ProcessingStatus, step: "Generating images...", progress: 0.5, duration: 8000 },
        { status: "upscaling" as ProcessingStatus, step: "Enhancing image quality...", progress: 0.9, duration: 2000 },
        { status: "completed" as ProcessingStatus, step: "Processing completed!", progress: 1.0, duration: 500 }
      ]

      for (const stepData of steps) {
        setProcessingStatus(stepData.status)
        setCurrentStep(stepData.step)
        setProgress(stepData.progress * 100)
        setElapsedTime((Date.now() - startTime) / 1000)
        
        if (stepData.status !== "completed") {
          setEstimatedTime((Date.now() - startTime) / 1000 / stepData.progress * (1 - stepData.progress))
        }
        
        await new Promise(resolve => setTimeout(resolve, stepData.duration))
      }

      // Create mock results using the uploaded image
      const mockResults = Array.from({ length: 3 }, (_, index) => ({
        imageUrl: uploadedImage!, // Use uploaded image as mock result
        seed: Math.floor(Math.random() * 1000000),
        parameters: {
          strength: parameters.strength,
          cfgScale: parameters.cfgScale,
          steps: parameters.steps,
          sampler: parameters.sampler
        },
        modelName: selectedModel.name,
        loraName: selectedModel.type === 'lora' ? selectedModel.name : undefined,
      }))
      
      // Save to database
      try {
        const resultIds = await createResults({ results: mockResults })
        if (resultIds.length > 0) {
          setSelectedResultId(resultIds[0])
        }
      } catch (error) {
        console.error("Failed to save results to database:", error)
      }
      
      setIsProcessing(false)

    } catch (error) {
      console.error('Error during mock processing:', error)
      setProcessingStatus("failed")
      setCurrentStep(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsProcessing(false)
    }
  }

  // Set selected result when results change
  useEffect(() => {
    if (convertedResults.length > 0 && !selectedResultId) {
      setSelectedResultId(convertedResults[0].id)
    }
  }, [convertedResults, selectedResultId])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Image
                  src="https://nextjs.org/icons/next.svg"
                  alt="Next.js"
                  width={32}
                  height={32}
                  className="dark:invert"
                />
                <Palette className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Neural Art Studio</h1>
                  <p className="text-sm text-muted-foreground">AI-Powered Style Transfer</p>
                </div>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-xs">
                Demo Mode
              </Badge>
            </div>
          </div>
        </div>
      </header>

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
              
              <ErrorBoundary>
                <PresetManager
                  presets={convertedPresets}
                  currentParameters={parameters}
                  onLoadPreset={handleLoadPreset}
                  onSavePreset={handleSavePreset}
                  onDeletePreset={handleDeletePreset}
                  onToggleFavorite={handleTogglePresetFavorite}
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
