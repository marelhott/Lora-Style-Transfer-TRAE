"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Settings, Heart, Upload as UploadIcon, Download } from "lucide-react"
import { PresetManager, Preset } from "@/components/preset-manager"

export interface ProcessingParameters {
  strength: number
  cfgScale: number
  steps: number
  clipSkip: number
  seed?: number
  sampler: string
  batchCount: number
  upscaleFactor?: 2 | 4
}

interface ParameterControlsProps {
  parameters: ProcessingParameters
  onParametersChange: (parameters: ProcessingParameters) => void
  onSavePreset: (name: string, parameters: ProcessingParameters) => void
  onLoadPreset: (preset: Preset) => void
  presets?: Preset[]
  onDeletePreset?: (presetId: string) => void
  onTogglePresetFavorite?: (presetId: string) => void
}

const SAMPLERS = [
  "Euler a",
  "Euler",
  "LMS",
  "Heun",
  "DPM2",
  "DPM2 a",
  "DPM++ 2S a",
  "DPM++ 2M",
  "DPM++ SDE",
  "DPM fast",
  "DPM adaptive",
  "LMS Karras",
  "DPM2 Karras",
  "DPM2 a Karras",
  "DPM++ 2S a Karras",
  "DPM++ 2M Karras",
  "DPM++ SDE Karras"
]

export function ParameterControls({
  parameters,
  onParametersChange,
  onSavePreset,
  onLoadPreset,
  presets = [],
  onDeletePreset = () => {},
  onTogglePresetFavorite = () => {}
}: ParameterControlsProps) {
  const [useRandomSeed, setUseRandomSeed] = useState(!parameters.seed)

  const updateParameter = <K extends keyof ProcessingParameters>(
    key: K, 
    value: ProcessingParameters[K]
  ) => {
    onParametersChange({ ...parameters, [key]: value })
  }

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 2147483647)
    updateParameter('seed', seed)
    setUseRandomSeed(false)
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          Parametry
        </h3>
        
        <div className="space-y-6">
          {/* Batch Count Buttons - moved to top */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Počet obrázků</Label>
            <div className="flex space-x-2">
              <Button
                variant={parameters.batchCount === 1 ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => updateParameter('batchCount', 1)}
              >
                1
              </Button>
              <Button
                variant={parameters.batchCount === 2 ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => updateParameter('batchCount', 2)}
              >
                2
              </Button>
              <Button
                variant={parameters.batchCount === 3 ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => updateParameter('batchCount', 3)}
              >
                3
              </Button>
            </div>
          </div>

          {/* Strength */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Síla</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {parameters.strength.toFixed(1)}
              </span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1.0" 
              step="0.05" 
              value={parameters.strength}
              onChange={(e) => updateParameter('strength', parseFloat(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.1</span>
              <span>1.0</span>
            </div>
          </div>

          {/* CFG Scale */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">CFG škála</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {parameters.cfgScale.toFixed(1)}
              </span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="30" 
              step="0.5" 
              value={parameters.cfgScale}
              onChange={(e) => updateParameter('cfgScale', parseFloat(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1.0</span>
              <span>30.0</span>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Kroky</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {parameters.steps}
              </span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="50" 
              step="1" 
              value={parameters.steps}
              onChange={(e) => updateParameter('steps', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          {/* Clip Skip */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Clip Skip</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {parameters.clipSkip}
              </span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="4" 
              step="1" 
              value={parameters.clipSkip}
              onChange={(e) => updateParameter('clipSkip', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>4</span>
            </div>
          </div>

          {/* Sampler */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vzorkovač</Label>
            <Select 
              value={parameters.sampler} 
              onValueChange={(value) => updateParameter('sampler', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLERS.map((sampler) => (
                  <SelectItem key={sampler} value={sampler}>
                    {sampler}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upscale Factor */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Zvětšení</Label>
            <Select 
              value={parameters.upscaleFactor?.toString() || "none"} 
              onValueChange={(value) => updateParameter('upscaleFactor', value === "none" ? undefined : parseInt(value) as 2 | 4)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez zvětšení</SelectItem>
                <SelectItem value="2">2x zvětšení</SelectItem>
                <SelectItem value="4">4x zvětšení</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Preset Controls */}
        </div>
      </Card>

      {/* Preset Manager - nahrazuje stará tlačítka */}
      <PresetManager
        presets={presets}
        onLoadPreset={onLoadPreset}
        onSavePreset={onSavePreset}
        onDeletePreset={onDeletePreset}
        onToggleFavorite={onTogglePresetFavorite}
        currentParameters={parameters}
      />
    </div>
  )
}
