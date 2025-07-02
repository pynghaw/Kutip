import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PickupTable from "@/components/tables/PickupTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Basic Table | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Basic Table  page for TailAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
};

export default function PickupTables() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Pickup Table" />
      <div className="space-y-6">
        <ComponentCard title="Pickup Table">
          <PickupTable />
        </ComponentCard>
      </div>
    </div>
  );
}
