import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import TrucksTable from "@/components/tables/TrucksTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Basic Table | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Basic Table  page for TailAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
};

export default function TrucksTables() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Trucks Management" />
      <div className="space-y-6">
        
          <TrucksTable />
        
      </div>
    </div>
  );
}
