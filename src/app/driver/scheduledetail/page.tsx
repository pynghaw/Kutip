"use client";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Details from "@/components/scheduledetails/detail";

export default function DriverScheduleDetailPage() {
  const router = useRouter();
  return (
    <div className="p-6">
      <PageBreadcrumb pageTitle="Schedule Details" />
      <Details filterByDriver={true} />
    </div>
  );
} 