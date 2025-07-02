'use client'

import { useEffect, useState } from 'react'

interface Plate {
  plate: string | null
  confidence: number
  timestamp: string | null
}

interface CameraViewerProps {
  scheduleId?: string
  routeId?: number
  onBinCollected?: (plate: string) => void
  isCollectionMode?: boolean
  autoDetectSchedule?: boolean
}

// Local storage keys for simulating database
const LOCAL_COLLECTIONS_KEY = 'local_bin_collections'
const LOCAL_SCHEDULES_KEY = 'local_active_schedules'

export default function CameraViewer({ 
  scheduleId, 
  routeId, 
  onBinCollected, 
  isCollectionMode = false,
  autoDetectSchedule = false
}: CameraViewerProps) {
  const [data, setData] = useState<Plate>({ plate: null, confidence: 0, timestamp: null })
  const [lastProcessedPlate, setLastProcessedPlate] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [collectionStatus, setCollectionStatus] = useState<string>('')


  // Local storage functions for simulating database
  const getLocalCollections = () => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(LOCAL_COLLECTIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  };

  const setLocalCollection = (plate: string, scheduleId: string, routeId?: number) => {
    if (typeof window === 'undefined') return;
    const collections = getLocalCollections();
    const key = `${scheduleId}-${routeId || 'default'}`;
    if (!collections[key]) collections[key] = [];
    collections[key].push({
      plate,
      collectedAt: new Date().toISOString(),
      scheduleId,
      routeId
    });
    localStorage.setItem(LOCAL_COLLECTIONS_KEY, JSON.stringify(collections));
    
    // Check if all plates for this schedule/route are collected
    checkAndUpdateScheduleCompletion(scheduleId, routeId);
  };

  const checkAndUpdateScheduleCompletion = async (scheduleId: string, routeId?: number) => {
    if (typeof window === 'undefined') return;
    
    // Get all known plates for this schedule/route
    const scheduleKey = `${scheduleId}-${routeId || 'default'}`;
    const collections = getLocalCollections();
    const collectedPlates = collections[scheduleKey] || [];
    
    // Get the list of known plates from the camera server config
    const knownPlates = [
      'BAM 9267', 'AAA 4444', 'WVX 3589', 'WXM 3268', 'WSN 5634',
      'IIUM 6763', 'VS 2277', 'WXS 3465', 'BGN 6677', 'JFC 2218'
    ];
    
    // Check if all known plates are collected
    const allCollected = knownPlates.every(plate => 
      collectedPlates.some((item: any) => item.plate === plate)
    );
    
    if (allCollected) {
      try {
        // Update schedule status in database
        const response = await fetch('/api/schedules/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            schedule_id: scheduleId,
            route_id: routeId
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`🎉 Schedule ${scheduleId} marked as completed in database!`);
          setCollectionStatus(`🎉 All ${knownPlates.length} bins collected! Schedule completed!`);
          setTimeout(() => setCollectionStatus(''), 5000);
          
          // Trigger callback to refresh parent components
          onBinCollected?.(`COMPLETED_${scheduleId}`);
        } else {
          console.error('Failed to update schedule status:', result.error);
          setCollectionStatus(`⚠️ Schedule completed locally but database update failed`);
          setTimeout(() => setCollectionStatus(''), 5000);
        }
      } catch (error) {
        console.error('Error updating schedule status:', error);
        setCollectionStatus(`⚠️ Schedule completed locally but database update failed`);
        setTimeout(() => setCollectionStatus(''), 5000);
      }
    } else {
      // Show progress
      const remaining = knownPlates.length - collectedPlates.length;
      if (remaining > 0) {
        setCollectionStatus(`📊 Progress: ${collectedPlates.length}/${knownPlates.length} bins collected (${remaining} remaining)`);
        setTimeout(() => setCollectionStatus(''), 3000);
      }
    }
  };

  const isPlateCollected = (plate: string, scheduleId: string, routeId?: number) => {
    const collections = getLocalCollections();
    const key = `${scheduleId}-${routeId || 'default'}`;
    return collections[key]?.some((item: any) => item.plate === plate) || false;
  };

  const clearLocalCollections = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(LOCAL_COLLECTIONS_KEY);
    localStorage.removeItem('local_schedule_statuses');
    console.log('Local collections and schedule statuses cleared');
  };

  // Expose clear function globally for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).clearLocalCollections = clearLocalCollections;
    }
  }, []);



  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8000/latest')
        if (res.ok) {
          const newData = await res.json()
          setData(newData)
          
          // If we're in collection mode and have a new plate detection
          if (isCollectionMode && 
              newData.plate && 
              newData.plate !== lastProcessedPlate && 
              newData.confidence > 0.7 && 
              !processing) {
            
            setProcessing(true)
            setCollectionStatus(`Processing ${newData.plate}...`)
            
            try {
              // Use props for schedule/route
              const currentScheduleId = scheduleId || 'local-schedule';
              const currentRouteId = routeId;
              
              if (!currentScheduleId) {
                setCollectionStatus('❌ No active schedule found');
                setTimeout(() => setCollectionStatus(''), 3000);
                setProcessing(false);
                return;
              }
              
              // Check if already collected locally
              if (isPlateCollected(newData.plate, currentScheduleId, currentRouteId)) {
                setCollectionStatus(`⚠️ ${newData.plate} already collected`);
                setTimeout(() => setCollectionStatus(''), 3000);
                setProcessing(false);
                return;
              }
              
              // Simulate processing delay
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Mark the bin as collected locally
              setLocalCollection(newData.plate, currentScheduleId, currentRouteId);
              
              setCollectionStatus(`✅ ${newData.plate} collected successfully!`)
              setLastProcessedPlate(newData.plate)
              onBinCollected?.(newData.plate)
              
              // Clear status after 3 seconds
              setTimeout(() => setCollectionStatus(''), 3000)
              
            } catch (error) {
              setCollectionStatus(`❌ Processing error`)
              setTimeout(() => setCollectionStatus(''), 3000)
            } finally {
              setProcessing(false)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching camera data:', error)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isCollectionMode, lastProcessedPlate, processing, scheduleId, routeId, onBinCollected])

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

      {isCollectionMode && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">Collection Mode</h4>
          

          
          <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
            {collectionStatus || 'Ready to scan bins. Point camera at bin plates to mark them as collected.'}
          </p>
          

          
          {processing && (
            <div className="mt-2 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-blue-600">Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
