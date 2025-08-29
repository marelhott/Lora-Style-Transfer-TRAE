"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Cpu,
  Image as ImageIcon,
  Zap,
  ArrowUp
} from "lucide-react"

export type ProcessingStatus = 
  | "pending"
  | "initializing" 
  | "loading_model"
  | "generating"
  | "upscaling"
  | "completed"
  | "failed"

interface ProgressTrackerProps {
  status: ProcessingStatus
  progress: number
  currentStep?: string
  estimatedTimeRemaining?: number
  elapsedTime?: number
  errorMessage?: string
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Čekání",
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  initializing: {
    icon: Loader2,
    label: "Inicializace",
    color: "text-blue-500",
    bgColor: "bg-blue-500"
  },
  loading_model: {
    icon: Cpu,
    label: "Načítání modelu",
    color: "text-purple-500",
    bgColor: "bg-purple-500"
  },
  generating: {
    icon: ImageIcon,
    label: "Generování",
    color: "text-orange-500",
    bgColor: "bg-orange-500"
  },
  upscaling: {
    icon: ArrowUp,
    label: "Zvětšování",
    color: "text-green-500",
    bgColor: "bg-green-500"
  },
  completed: {
    icon: CheckCircle,
    label: "Dokončeno",
    color: "text-green-600",
    bgColor: "bg-green-600"
  },
  failed: {
    icon: AlertCircle,
    label: "Chyba",
    color: "text-red-500",
    bgColor: "bg-red-500"
  }
}

const PROCESSING_STEPS = [
  { key: "initializing", label: "Inicializace", icon: Zap },
  { key: "loading_model", label: "Načítání", icon: Cpu },
  { key: "generating", label: "Generování", icon: ImageIcon },
  { key: "upscaling", label: "Zvětšování", icon: ArrowUp },
  { key: "completed", label: "Hotovo", icon: CheckCircle }
]

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function ProgressTracker({
  status,
  progress,
  currentStep,
  estimatedTimeRemaining,
  elapsedTime,
  errorMessage
}: ProgressTrackerProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const isProcessing = !["pending", "completed", "failed"].includes(status)

  return (
    <Card className="p-2">
      <div className="space-y-2">
        
        {/* Status Header - extremely compact */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon 
              className={`w-3 h-3 ${config.color} ${isProcessing ? 'animate-spin' : ''}`}
            />
            <span className="font-medium text-sm">{config.label}</span>
            {status === "failed" && (
              <Badge variant="destructive" className="text-xs h-5">
                Chyba
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {progress}%
          </span>
        </div>

        {/* Progress Bar - normal size */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          
          {/* Step Indicators - normal size */}
          <div className="flex justify-between items-center">
            {PROCESSING_STEPS.map((step, index) => {
              const isActive = step.key === status
              const isCompleted = PROCESSING_STEPS.findIndex(s => s.key === status) > index
              const StepIcon = step.icon
              
              return (
                <div key={step.key} className="flex flex-col items-center">
                  <div className={`
                    w-4 h-4 rounded-full flex items-center justify-center
                    ${isActive ? `${config.bgColor} text-white` : 
                      isCompleted ? 'bg-green-500 text-white' : 
                      'bg-muted text-muted-foreground'}
                  `}>
                    <StepIcon className="w-2 h-2" />
                  </div>
                  <span className={`text-xs ${
                    isActive ? config.color : 
                    isCompleted ? 'text-green-600' : 
                    'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status Details - compact */}
        {(currentStep || errorMessage || elapsedTime !== undefined || (estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0)) && (
          <div className="flex justify-between items-center text-sm">
            <div>
              {currentStep && (
                <span className="text-muted-foreground">
                  {currentStep}
                </span>
              )}
              {errorMessage && (
                <span className="text-red-500">
                  {errorMessage}
                </span>
              )}
            </div>
            
            <div className="text-right">
              {elapsedTime !== undefined && (
                <span className="text-muted-foreground font-mono">
                  Uplynulo: {formatTime(elapsedTime)}
                </span>
              )}
              {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
                <span className="text-muted-foreground font-mono ml-2">
                  Zbývá: {formatTime(estimatedTimeRemaining)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}