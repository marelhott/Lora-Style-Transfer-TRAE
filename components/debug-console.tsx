"use client"

import { useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type DebugEntry = {
  t: number
  level: "info" | "warn" | "error"
  msg: string
}

export function DebugConsole({
  entries,
  onClear
}: {
  entries: DebugEntry[]
  onClear: () => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries])

  const formatTime = (t: number) => new Date(t).toLocaleTimeString()

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Diagnostika</div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
          <Button size="sm" variant="outline" onClick={onClear}>Smazat</Button>
        </div>
      </div>
      <div ref={scrollerRef} className="h-40 overflow-auto rounded border bg-black text-white text-xs p-2 space-y-1">
        {entries.length === 0 ? (
          <div className="opacity-60">Žádné záznamy</div>
        ) : (
          entries.map((e, i) => (
            <div key={i} className={
              e.level === 'error' ? 'text-red-300' : e.level === 'warn' ? 'text-yellow-300' : 'text-green-300'
            }>
              [{formatTime(e.t)}] {e.level.toUpperCase()}: {e.msg}
            </div>
          ))
        )}
      </div>
    </Card>
  )
}


