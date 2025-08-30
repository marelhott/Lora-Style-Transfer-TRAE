"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileBrowser } from "@/components/file-browser"
import { Settings, Wifi, WifiOff, Server, Zap, HardDrive, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BackendInfo {
  status: string
  gpu?: string
  models?: number
  loras?: number
  memory?: string
}

export function BackendSettings() {
  const [backendUrl, setBackendUrl] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Načtení uložené URL při startu
  useEffect(() => {
    const savedUrl = localStorage.getItem("backend_url") || process.env.NEXT_PUBLIC_API_URL || ""
    setBackendUrl(savedUrl)
    testConnection(savedUrl, false)
  }, [])

  const testConnection = async (url: string, showToast = true) => {
    if (!url) return
    
    setIsConnecting(true)
    setError(null)
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        setBackendInfo({
          status: data.status || "healthy",
          gpu: data.gpu_info?.name,
          models: data.models_count,
          loras: data.loras_count,
          memory: data.gpu_info?.memory
        })
        setIsConnected(true)
        if (showToast) {
          toast({
            title: "✅ Připojení úspěšné",
            description: `Backend je dostupný na ${url}`
          })
        }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      setIsConnected(false)
      setBackendInfo(null)
      const errorMsg = err instanceof Error ? err.message : "Neznámá chyba"
      setError(`Připojení selhalo: ${errorMsg}`)
      if (showToast) {
        toast({
          title: "❌ Připojení selhalo",
          description: errorMsg,
          variant: "destructive"
        })
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnect = () => {
    if (!backendUrl) {
      toast({
        title: "⚠️ Chybí URL",
        description: "Zadejte URL backendu",
        variant: "destructive"
      })
      return
    }
    
    // Uložení URL
    localStorage.setItem("backend_url", backendUrl)
    
    // Aktualizace globální proměnné pro API calls
    if (typeof window !== "undefined") {
      (window as any).BACKEND_URL = backendUrl
    }
    
    testConnection(backendUrl, true)
    
    toast({
      title: "🔄 Backend URL aktualizováno",
      description: "Restartujte stránku pro úplné načtení"
    })
  }

  const getStatusColor = () => {
    if (isConnecting) return "bg-yellow-500"
    return isConnected ? "bg-green-500" : "bg-red-500"
  }

  const getStatusText = () => {
    if (isConnecting) return "Připojování..."
    return isConnected ? "Připojeno" : "Odpojeno"
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Backend Connection Settings
        </CardTitle>
        <CardDescription>
          Nastavte připojení k backend API serveru
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connection">Připojení</TabsTrigger>
            <TabsTrigger value="files">Soubory</TabsTrigger>
          </TabsList>
          
          <TabsContent value="connection" className="space-y-4">
        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Backend URL:</label>
          <div className="flex gap-2">
            <Input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://your-backend-url:8000"
              className="flex-1 min-w-0 text-sm font-mono"
              style={{ minWidth: '400px' }}
            />
            <Button
              onClick={() => testConnection(backendUrl, true)}
              disabled={isConnecting || !backendUrl}
              variant="outline"
              size="sm"
            >
              Test
            </Button>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !backendUrl}
              size="sm"
            >
              Connect
            </Button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
            {getStatusText()}
          </Badge>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Backend Info */}
        {isConnected && backendInfo && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className="text-sm font-medium">Backend Info:</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Status: {backendInfo.status}
              </div>
            </div>
            
            {backendInfo.gpu && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">GPU:</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {backendInfo.gpu}
                  {backendInfo.memory && ` (${backendInfo.memory})`}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <span className="text-sm font-medium">Modely:</span>
              <div className="text-sm text-muted-foreground">
                {backendInfo.models || 0} Stable Diffusion
              </div>
            </div>
            
            <div className="space-y-2">
              <span className="text-sm font-medium">LoRA:</span>
              <div className="text-sm text-muted-foreground">
                {backendInfo.loras || 0} LoRA modelů
              </div>
            </div>
          </div>
        )}

        {/* Quick URLs */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Rychlé nastavení:</span>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Pro development použij localhost, jinak zkus detekovat RunPod URL
                if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                  setBackendUrl("http://localhost:8000")
                } else {
                  // Zkus použít automatickou detekci
                  const hostname = window.location.hostname
                  if (hostname.includes('proxy.runpod.net')) {
                    const baseId = hostname.split('.')[0].replace('-3000', '').replace('-8000', '')
                    setBackendUrl(`https://${baseId}-8000.proxy.runpod.net`)
                  } else {
                    setBackendUrl("http://localhost:8000")
                  }
                }
              }}
            >
              Localhost
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const hostname = window.location.hostname
                  const href = window.location.href
                  
                  // Extrahuj base ID z aktuální RunPod URL
                  const runpodMatch = href.match(/https?:\/\/([^-\.]+)(-\d+)?\.proxy\.runpod\.net/)
                  if (runpodMatch) {
                    const baseId = runpodMatch[1]
                    const apiUrl = `https://${baseId}-8000.proxy.runpod.net`
                    setBackendUrl(apiUrl)
                    return
                  }
                  
                  // Pokud hostname obsahuje RunPod pattern
                  if (hostname.includes('proxy.runpod.net')) {
                    const baseId = hostname.split('.')[0].replace('-3000', '').replace('-8000', '')
                    const apiUrl = `https://${baseId}-8000.proxy.runpod.net`
                    setBackendUrl(apiUrl)
                    return
                  }
                  
                  // Pokud nejsme na localhost, zkus vytvořit RunPod URL
                  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                    const baseId = hostname.split('.')[0].replace('-3000', '')
                    const apiUrl = `https://${baseId}-8000.proxy.runpod.net`
                    setBackendUrl(apiUrl)
                    return
                  }
                }
                
                // Fallback mock URL
                setBackendUrl("https://your-runpod-8000.proxy.runpod.net")
              }}
            >
              RunPod Template
            </Button>
          </div>
        </div>
          </TabsContent>
          
          <TabsContent value="files" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm font-medium">Správa souborů:</span>
              </div>
              {isConnected ? (
                <FileBrowser 
                  apiBaseUrl={backendUrl}
                  onSelectPath={(path, type) => {
                    toast({
                      title: "Cesta nastavena",
                      description: `${type === 'models' ? 'Modely' : 'LoRA'}: ${path}`
                    })
                  }}
                  onScanModels={async (modelsPath, lorasPath) => {
                    try {
                      const response = await fetch(`${backendUrl}/api/scan-models`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ models_path: modelsPath, loras_path: lorasPath })
                      })
                      if (response.ok) {
                        const result = await response.json()
                        toast({
                          title: "Modely načteny",
                          description: `Nalezeno ${result.models_found} modelů`
                        })
                        // Reload models in parent component
                        window.location.reload()
                      } else {
                        throw new Error('Scan failed')
                      }
                    } catch (error) {
                      toast({
                        title: "Chyba",
                        description: "Nepodařilo se načíst modely",
                        variant: "destructive"
                      })
                    }
                  }}
                />
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Pro přístup k souborům se nejprve připojte k backendu.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}