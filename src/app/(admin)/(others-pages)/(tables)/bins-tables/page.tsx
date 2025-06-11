import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import BinsTable from "@/components/tables/BinsTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Basic Table | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Basic Table  page for TailAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
};

export default function BinsTables() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Bins Details" />
      <div className="space-y-6">        
          <BinsTable />        
      </div>
    </div>
  );
}
