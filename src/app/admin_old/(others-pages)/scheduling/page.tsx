"use client";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SchedulingMap from "@/components/maps/SchedulingMap";

export default function SchedulingPage() {
const router = useRouter();
  const handleNavigate = () => {
    router.push("/scheduling");
  };
  return (
    <div className="p-6">
       <PageBreadcrumb pageTitle="Scheduling" />
      <SchedulingMap />
    </div>
  );
}
