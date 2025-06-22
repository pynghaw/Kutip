"use client";
import CameraViewer from "@/components/camera/CameraViewer";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function DriverCameraPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Camera System" />
      
      {/* Live camera section */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-gray-900">
        <h3 className="mb-5 text-lg font-semibold">Live Bin Plate Detection</h3>
        <CameraViewer />
      </div>
    </div>
  );
} 