"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Heart, 
  Plus, 
  Trash2, 
  Upload,
  Palette,
  Settings
} from "lucide-react"
import { ProcessingParameters } from "./parameter-controls"

export interface Preset {
  id: string
  name: string
  parameters: ProcessingParameters
  isFavorite: boolean
  createdAt: number
  updatedAt: number
}

interface PresetManagerProps {
  presets: Preset[]
  onLoadPreset: (preset: Preset) => void
  onSavePreset: (name: string, parameters: ProcessingParameters) => void
  onDeletePreset: (presetId: string) => void
  onToggleFavorite: (presetId: string) => void
  currentParameters: ProcessingParameters
}

export function PresetManager({
  presets,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  onToggleFavorite,
  currentParameters
}: PresetManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState("")

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim(), currentParameters)
      setPresetName("")
      setIsDialogOpen(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          Předvolby
          {presets.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {presets.length}
            </Badge>
          )}
        </h3>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Uložit předvolbu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Název předvolby</label>
                <Input
                  placeholder="Zadejte název předvolby..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSavePreset()
                    }
                  }}
                />
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Zrušit
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                >
                  Uložit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Simple row layout for presets */}
      <div className="space-y-2">
        {presets.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Žádné uložené předvolby</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Vytvořit první předvolbu
            </Button>
          </div>
        ) : (
          presets.slice(0, 5).map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <Palette className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{preset.name}</span>
                {preset.isFavorite && (
                  <Heart className="w-3 h-3 text-red-500 fill-current flex-shrink-0" />
                )}
              </div>
              
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(preset.id)}
                  className="h-6 w-6 p-0"
                >
                  <Heart 
                    className={`w-3 h-3 ${
                      preset.isFavorite ? "fill-red-500 text-red-500" : ""
                    }`} 
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLoadPreset(preset)}
                  className="h-6 w-6 p-0"
                >
                  <Upload className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeletePreset(preset.id)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}