"use client"

import { useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  onImageUpload: (file: File, base64: string) => void
  uploadedImage: string | null
  onRemoveImage: () => void
  className?: string
}

export function ImageUpload({ 
  onImageUpload, 
  uploadedImage, 
  onRemoveImage, 
  className 
}: ImageUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      onImageUpload(file, base64)
    }
    reader.readAsDataURL(file)
  }, [onImageUpload])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      processFile(imageFile)
    }
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      processFile(file)
    }
  }, [processFile])

  return (
    <Card className={cn("p-3", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-3 text-center transition-all duration-200 cursor-pointer",
          isDragActive 
            ? "border-primary bg-primary/5 scale-105" 
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          uploadedImage && "border-solid border-border"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => {
          if (!uploadedImage) {
            document.getElementById('file-input')?.click()
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        {uploadedImage ? (
          <div className="space-y-2">
            <div className="relative group">
              <img 
                src={uploadedImage} 
                alt="Uploaded" 
                className="w-full h-20 object-cover rounded-lg" // Further reduced height from h-32 to h-20
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveImage()
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">Obrázek připraven</p>
              <p className="text-xs text-muted-foreground">Klikněte pro nahrazení</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className={cn(
              "transition-transform duration-200",
              isDragActive && "scale-110"
            )}>
              <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
            </div>
            <div>
              <p className="text-xs font-medium">
                {isDragActive ? "Přetáhněte obrázek sem" : "Přetáhněte obrázek sem"}
              </p>
              <p className="text-xs text-muted-foreground">
                nebo klikněte pro procházení
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max: 10MB
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}