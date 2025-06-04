"use client";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Details from "@/components/scheduledetails/detail";

export default function SchedulingPage() {
const router = useRouter();
  const handleNavigate = () => {
    router.push("/scheduledetail");
  };
  return (
    <div className="p-6">
       <PageBreadcrumb pageTitle="Schedule Details" />
      < Details  />
    </div>
  );
}
