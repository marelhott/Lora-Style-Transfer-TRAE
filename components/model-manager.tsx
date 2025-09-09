

"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { 
  Plus, 
  Trash2, 
  Download, 
  Upload,
  Cpu,
  Palette,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface AIModel {
  id: string
  name: string
  type: "lora" | "full"
  fileSize: number
  uploadedAt: number
  metadata?: {
    description?: string
    tags?: string[]
    category?: string
  }
}

interface ModelManagerProps {
  models: AIModel[]
  selectedModelId: string | null
  onModelSelect: (modelId: string) => void
  onModelUpload: () => void
  onModelDelete: (modelId: string) => void
  onScanDisk?: () => void
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

export function ModelManager({ 
  models, 
  selectedModelId, 
  onModelSelect, 
  onModelUpload, 
  onModelDelete,
  onScanDisk,
  className 
}: ModelManagerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["lora", "full"])
  )

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const loraModels = models.filter(m => m.type === "lora")
  const fullModels = models.filter(m => m.type === "full")

  const handleModelUpload = () => {
    onModelUpload()
  }

  const handleModelDelete = (modelId: string) => {
    onModelDelete(modelId)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center">
            <Cpu className="w-4 h-4 mr-2" />
            AI Modely
          </h3>
          <div className="flex gap-2">
            {onScanDisk && (
              <Button size="sm" variant="outline" onClick={onScanDisk}>
                <HardDrive className="w-4 h-4 mr-1" />
                Scan Disk
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleModelUpload}>
              <Plus className="w-4 h-4 mr-1" />
              Nahrát
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          
          {/* LoRA Models Section */}
          <div>
            <button
              onClick={() => toggleSection("lora")}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center space-x-2">
                {expandedSections.has("lora") ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Palette className="w-4 h-4" />
                <h4 className="text-sm font-medium">LoRA Modely</h4>
                <Badge variant="secondary" className="text-xs">
                  {loraModels.length}
                </Badge>
              </div>
            </button>
            
            {expandedSections.has("lora") && (
              <div className="mt-3 space-y-2 pl-6">
                {loraModels.length > 0 ? (
                  loraModels.map((model) => (
                    <div key={model.id} className="group">
                      <div 
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-sm",
                          selectedModelId === model.id 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => onModelSelect(model.id)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{model.name}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge 
                                  variant={model.type === "lora" ? "secondary" : "outline"} 
                                  className="text-xs"
                                >
                                  {model.type.toUpperCase()}
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleModelDelete(model.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1">
                                <HardDrive className="w-3 h-3" />
                                <span>{formatFileSize(model.fileSize)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(model.uploadedAt)}</span>
                              </div>
                            </div>
                            
                            {model.metadata?.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {model.metadata.description}
                              </p>
                            )}
                            
                            {model.metadata?.tags && model.metadata.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {model.metadata.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {model.metadata.tags.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{model.metadata.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Žádné LoRA modely nahrány</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2"
                      onClick={handleModelUpload}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Nahrát první LoRA
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Full Models Section */}
          <div>
            <button
              onClick={() => toggleSection("full")}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center space-x-2">
                {expandedSections.has("full") ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Cpu className="w-4 h-4" />
                <h4 className="text-sm font-medium">Plné modely</h4>
                <Badge variant="secondary" className="text-xs">
                  {fullModels.length}
                </Badge>
              </div>
            </button>
            
            {expandedSections.has("full") && (
              <div className="mt-3 space-y-2 pl-6">
                {fullModels.length > 0 ? (
                  fullModels.map((model) => (
                    <div key={model.id} className="group">
                      <div 
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-sm",
                          selectedModelId === model.id 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => onModelSelect(model.id)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{model.name}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge 
                                  variant={model.type === "lora" ? "secondary" : "outline"} 
                                  className="text-xs"
                                >
                                  {model.type.toUpperCase()}
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleModelDelete(model.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1">
                                <HardDrive className="w-3 h-3" />
                                <span>{formatFileSize(model.fileSize)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(model.uploadedAt)}</span>
                              </div>
                            </div>
                            
                            {model.metadata?.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {model.metadata.description}
                              </p>
                            )}
                            
                            {model.metadata?.tags && model.metadata.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {model.metadata.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {model.metadata.tags.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{model.metadata.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Žádné plné modely nahrány</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2"
                      onClick={handleModelUpload}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Nahrát první model
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{models.length}</p>
              <p className="text-xs text-muted-foreground">Celkem modelů</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {models.length}
              </p>
              <p className="text-xs text-muted-foreground">Celkem</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

