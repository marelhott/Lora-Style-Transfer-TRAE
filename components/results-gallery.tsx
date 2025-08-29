




"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Download, 
  ZoomIn, 
  Image as ImageIcon,
  Grid3X3,
  Maximize2,
  DownloadCloud,
  Heart,
  Share2
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface GeneratedResult {
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

interface ResultsGalleryProps {
  results: GeneratedResult[]
  selectedResultId: string | null
  onResultSelect: (resultId: string) => void
  onDownload: (resultId: string) => void
  onDownloadAll: () => void
  onToggleFavorite: (resultId: string) => void
  onShare: (resultId: string) => void
  className?: string
}

export function ResultsGallery({
  results,
  selectedResultId,
  onResultSelect,
  onDownload,
  onDownloadAll,
  onToggleFavorite,
  onShare,
  className
}: ResultsGalleryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "single">("single")

  const selectedResult = results.find(r => r.id === selectedResultId) || results[0]

  const formatSeed = (seed: number) => {
    return seed.toString().slice(0, 8) + "..."
  }

  // Function to open image in full size in new window
  const openImageInNewWindow = (imageUrl: string) => {
    const newWindow = window.open('', '_blank')
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Neural Art Studio - Obrázek v plné velikosti</title>
            <style>
              body { 
                margin: 0; 
                padding: 20px; 
                background: #000; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh;
              }
              img { 
                max-width: 100%; 
                max-height: 100vh; 
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(255,255,255,0.1);
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="Obrázek v plné velikosti" />
          </body>
        </html>
      `)
      newWindow.document.close()
    }
  }

  // Get the latest 3 results for the triple view
  const latestResults = results.slice(0, 3)

  return (
    <div className={cn("h-full", className)}>
      <Card className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold flex items-center">
            <ImageIcon className="w-4 h-4 mr-2" />
            Výsledky
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {results.length}
              </Badge>
            )}
          </h3>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("single")}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={onDownloadAll}>
                <DownloadCloud className="w-4 h-4 mr-1" />
                Vše
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 p-4 min-h-0">
          {results.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Zatím žádné výsledky</p>
                <p className="text-sm">Nahrajte obrázek a vyberte model pro začátek generování</p>
              </div>
            </div>
          ) : (
            <div className="h-full">
              
              {/* Triple Image View Mode */}
              {viewMode === "single" && latestResults.length > 0 && (
                <div className="h-full flex flex-col space-y-4">
                  {/* Main Container with 3 images - takes most of the height */}
                  <div className="flex gap-4 flex-1 min-h-[1000px]"> {/* Dramatically increased min-height */}
                    {/* Main Image (Left Side) */}
                    <div className="flex-1 relative group">
                      <div 
                        className="relative overflow-hidden rounded-lg bg-muted cursor-pointer transition-transform duration-200 hover:scale-[1.02] h-full"
                        onClick={() => latestResults[0] && onResultSelect(latestResults[0].id)}
                        onDoubleClick={() => latestResults[0] && openImageInNewWindow(latestResults[0].imageUrl)}
                      >
                        <img 
                          src={latestResults[0]?.imageUrl} 
                          alt="Hlavní generovaný výsledek"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      
                      {/* Action Buttons for Main Image */}
                      {latestResults[0] && (
                        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleFavorite(latestResults[0].id)
                            }}
                          >
                            <Heart 
                              className={cn(
                                "w-4 h-4",
                                latestResults[0].isFavorite && "fill-red-500 text-red-500"
                              )} 
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onShare(latestResults[0].id)
                            }}
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDownload(latestResults[0].id)
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Thumbnails (Right Side) */}
                    <div className="w-32 flex flex-col gap-2">
                      {latestResults.slice(1, 3).map((result, index) => (
                        <div
                          key={result.id}
                          className="relative group flex-1"
                        >
                          <div
                            className={cn(
                              "w-full h-full rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2",
                              selectedResultId === result.id 
                                ? "border-primary shadow-md scale-105" 
                                : "border-transparent hover:border-muted-foreground/50 hover:scale-102"
                            )}
                            onClick={() => onResultSelect(result.id)}
                            onDoubleClick={() => openImageInNewWindow(result.imageUrl)}
                          >
                            <img 
                              src={result.imageUrl} 
                              alt={`Náhled výsledku ${index + 2}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          {/* Mini action buttons for thumbnails */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDownload(result.id)
                              }}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Empty slots if less than 3 images */}
                      {latestResults.length < 3 && (
                        <div className="flex-1 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                      {latestResults.length < 2 && (
                        <div className="flex-1 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Result Info for Selected Image - compact at bottom */}
                  {selectedResult && (
                    <div className="p-3 bg-muted/50 rounded-lg flex-shrink-0">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Seed:</span>
                          <span className="ml-2 font-mono">{formatSeed(selectedResult.seed)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Kroky:</span>
                          <span className="ml-2">{selectedResult.parameters.steps}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CFG:</span>
                          <span className="ml-2">{selectedResult.parameters.cfgScale}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vzorkovač:</span>
                          <span className="ml-2">{selectedResult.parameters.sampler}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grid View Mode */}
              {viewMode === "grid" && (
                <div className="h-full overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    {results.map((result) => (
                      <div key={result.id} className="group relative">
                        <div 
                          className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105"
                          onClick={() => onResultSelect(result.id)}
                          onDoubleClick={() => openImageInNewWindow(result.imageUrl)}
                        >
                          <img 
                            src={result.imageUrl} 
                            alt="Generovaný výsledek"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleFavorite(result.id)
                              }}
                            >
                              <Heart 
                                className={cn(
                                  "w-4 h-4",
                                  result.isFavorite && "fill-red-500 text-red-500"
                                )} 
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDownload(result.id)
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Result Badge */}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatSeed(result.seed)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
