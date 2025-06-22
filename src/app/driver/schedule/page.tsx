"use client";
import DriverManageSchedule from "@/components/manageschedules/DriverManageSchedule";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function DriverSchedulePage() {
  return (
    <div className="p-6">
      <PageBreadcrumb pageTitle="My Schedule" />
      <DriverManageSchedule />
    </div>
  );
} 