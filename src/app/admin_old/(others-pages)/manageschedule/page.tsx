"use client";

import ManageSchedule from "@/components/manageschedules/manage";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";


export default function ManageSchedulePage() {
  return (
    <div className="p-6">
      <PageBreadcrumb pageTitle="Manage Schedule" />
      <ManageSchedule />
    </div>
  );
}


