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
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 h-[600px] space-y-4">
        <PageBreadcrumb pageTitle="Bin Location" />

        <BinMap />

        {/* 🔘 Navigation Button */}
        <div className="flex justify-end">
          <button
            onClick={handleNavigate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Scheduling
          </button>
        </div>
      </div>
    </>
  );
}
