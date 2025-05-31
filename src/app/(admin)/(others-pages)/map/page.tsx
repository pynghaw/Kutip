"use client";

import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import BinMap from "@/components/maps/BinMap";

export default function MapPage() {
  const router = useRouter();

  const handleNavigate = () => {
    router.push("/scheduling");
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 sm:p-6 space-y-4 h-[700px] flex flex-col">
      {/* 🔖 Breadcrumb */}
      <PageBreadcrumb pageTitle="Bin Location" />

      {/* 🗺️ Map (set fixed height) */}
      <div className="flex-1 overflow-hidden rounded-xl border border-gray-300">
        <BinMap />
      </div>

      {/* 🚚 Button aligned to right */}
      <div className="flex justify-end">
        <button
          onClick={handleNavigate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go to Scheduling
        </button>
      </div>
    </div>
  );
}
