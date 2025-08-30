"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Folder, 
  File, 
  ArrowLeft, 
  RefreshCw, 
  HardDrive,
  FileText,
  AlertCircle
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileItem {
  name: string
  path: string
  is_directory: boolean
  is_model: boolean
  size: number
  modified: number
}

interface DirectoryData {
  current_path: string
  parent_path: string | null
  items: FileItem[]
}

interface FileBrowserProps {
  apiBaseUrl: string
  onSelectPath?: (path: string, type: 'models' | 'loras') => void
  onScanModels?: (modelsPath: string, lorasPath: string) => void
}

export function FileBrowser({ apiBaseUrl, onSelectPath, onScanModels }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/data")
  const [directoryData, setDirectoryData] = useState<DirectoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelsPath, setSelectedModelsPath] = useState("/data/models")
  const [selectedLorasPath, setSelectedLorasPath] = useState("/data/loras")

  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/browse-directory?path=${encodeURIComponent(path)}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setDirectoryData(data)
      setCurrentPath(data.current_path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
    } finally {
      setLoading(false)
    }
  }

  const handleItemClick = (item: FileItem) => {
    if (item.is_directory) {
      loadDirectory(item.path)
    }
  }

  const handleGoUp = () => {
    if (directoryData?.parent_path) {
      loadDirectory(directoryData.parent_path)
    }
  }

  const handleSelectPath = (type: 'models' | 'loras') => {
    if (type === 'models') {
      setSelectedModelsPath(currentPath)
    } else {
      setSelectedLorasPath(currentPath)
    }
    onSelectPath?.(currentPath, type)
  }

  const handleScanModels = async () => {
    if (!onScanModels) return
    
    setLoading(true)
    try {
      await onScanModels(selectedModelsPath, selectedLorasPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan models')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  useEffect(() => {
    loadDirectory(currentPath)
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Persistent Disk Browser
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoUp}
            disabled={!directoryData?.parent_path || loading}
          >
            <ArrowLeft className="h-4 w-4" />
            Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex-1 text-sm text-muted-foreground font-mono">
            {currentPath}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Directory Contents */}
        <ScrollArea className="h-64 border rounded-md">
          <div className="p-2 space-y-1">
            {directoryData?.items.map((item) => (
              <div
                key={item.path}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                onClick={() => handleItemClick(item)}
              >
                {item.is_directory ? (
                  <Folder className="h-4 w-4 text-blue-500" />
                ) : (
                  <File className={`h-4 w-4 ${item.is_model ? 'text-green-500' : 'text-gray-500'}`} />
                )}
                <span className="flex-1 text-sm">{item.name}</span>
                {item.is_model && (
                  <Badge variant="secondary" className="text-xs">
                    Model
                  </Badge>
                )}
                {!item.is_directory && (
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(item.size)}
                  </span>
                )}
              </div>
            ))}
            {directoryData?.items.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Directory is empty
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Path Selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectPath('models')}
              disabled={loading}
            >
              Set as Models Path
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectPath('loras')}
              disabled={loading}
            >
              Set as LoRAs Path
            </Button>
          </div>
          
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Models:</span>
              <span className="font-mono">{selectedModelsPath}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">LoRAs:</span>
              <span className="font-mono">{selectedLorasPath}</span>
            </div>
          </div>

          <Button
            onClick={handleScanModels}
            disabled={loading}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Scan Models from Selected Paths
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}