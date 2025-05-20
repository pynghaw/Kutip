"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import BinMap from "@/components/maps/BinMap";

export default function MapPage() {
  return (
    <>      
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 h-[600px]">
      <PageBreadcrumb pageTitle="Bin Location" />
        <BinMap />
      </div>
    </>
  );
}