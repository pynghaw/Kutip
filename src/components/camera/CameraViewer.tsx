'use client'

import { useEffect, useState } from 'react'

interface Plate {
  plate: string | null
  confidence: number
  timestamp: string | null
}

export default function CameraViewer() {
  const [data, setData] = useState<Plate>({ plate: null, confidence: 0, timestamp: null })

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('http://localhost:8000/latest')
      if (res.ok) setData(await res.json())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg border">
        {/* MJPEG stream */}
        <img
          className="w-full"
          src="http://localhost:8000/stream"
          alt="Live camera feed"
        />
      </div>
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
        <h4 className="text-sm font-medium">Last Detected Plate</h4>
        {data.plate ? (
          <p className="mt-2 text-lg font-semibold">
            {data.plate} &ndash; { (data.confidence * 100).toFixed(1) }%<br/>
            <span className="text-xs text-gray-500">{data.timestamp}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Waiting for detection…</p>
        )}
      </div>
    </div>
  )
}
