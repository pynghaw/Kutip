"use client";
import { useState, useEffect } from "react";
import CameraViewer from "@/components/camera/CameraViewer";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function CameraTestPage() {
  const [showLocalData, setShowLocalData] = useState(false);
  const [collectionProgress, setCollectionProgress] = useState({ collected: 0, total: 10 });

  const clearLocalData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('local_bin_collections');
      setShowLocalData(false);
      setCollectionProgress({ collected: 0, total: 10 });
      alert('Local data cleared! Refresh the page to see changes.');
    }
  };

  const updateProgress = () => {
    if (typeof window !== 'undefined') {
      const collections = JSON.parse(localStorage.getItem('local_bin_collections') || '{}');
      const scheduleKey = 'local-schedule-1-1'; // Default test schedule key
      const collectedPlates = collections[scheduleKey] || [];
      
      setCollectionProgress({
        collected: collectedPlates.length,
        total: 10
      });
    }
  };

  // Update progress when component mounts and periodically
  useEffect(() => {
    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, []);

  const viewLocalData = () => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('local_bin_collections');
      console.log('Local collections:', data);
      setShowLocalData(true);
    }
  };

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Camera Test (Local Mode)" />
      
      {/* Test Controls */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold">Local Test Controls</h3>
        <div className="flex gap-4 mb-4">
          <button
            onClick={clearLocalData}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Clear Local Data
          </button>
          <button
            onClick={viewLocalData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            View Local Data
          </button>
        </div>
        
        {/* Progress Display */}
        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-medium text-green-800 mb-2">Collection Progress</h4>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-green-700">
              {collectionProgress.collected} of {collectionProgress.total} bins collected
            </span>
            <span className="text-sm font-medium text-green-700">
              {Math.round((collectionProgress.collected / collectionProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-green-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(collectionProgress.collected / collectionProgress.total) * 100}%` }}
            ></div>
          </div>
          

        </div>
        
        {showLocalData && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Local Collection Data:</h4>
            <pre className="text-xs overflow-auto">
              {localStorage.getItem('local_bin_collections') || 'No data'}
            </pre>
          </div>
        )}
      </div>
      
      {/* Camera Section */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-gray-900">
        <h3 className="mb-5 text-lg font-semibold">Local Camera Test</h3>
        <CameraViewer 
          isCollectionMode={true}
          autoDetectSchedule={true}
          onBinCollected={(plate) => {
            console.log(`Bin ${plate} collected locally!`);
            if (plate.startsWith('COMPLETED_')) {
              console.log('🎉 Schedule completed!');
              updateProgress();
            }
          }}
        />
      </div>
      
      {/* Instructions */}
      <div className="rounded-2xl border p-5 bg-yellow-50 border-yellow-200">
        <h3 className="mb-4 text-lg font-semibold text-yellow-800">Test Instructions</h3>
        <div className="space-y-2 text-sm text-yellow-700">
          <p>1. <strong>Start your Python camera server:</strong> <code>cd YoloCamera && python camera_server.py</code></p>
          <p>2. <strong>Point camera at bin plates</strong> from your known list: BAM 9267, AAA 4444, WVX 3589, etc.</p>
          <p>3. <strong>Watch the collection status</strong> update in real-time</p>
          <p>4. <strong>Check local storage</strong> to see collected data</p>
          <p>5. <strong>Use "Clear Local Data"</strong> to reset for testing</p>
          <p className="mt-4 font-medium">⚠️ This is local-only mode - no database changes are made!</p>
        </div>
      </div>
    </div>
  );
} 