import type { Metadata } from "next";
import { Summary } from "@/components/dashboard/Summary";
import React from "react";
import PickupTrendsChart from "@/components/dashboard/PickupTrendsChart";
import DemographicCard from "@/components/dashboard/DemographicCard";
import TruckSchedule from "@/components/dashboard/TruckSchedule";

export const metadata: Metadata = {
  title:
    "Next.js E-commerce Dashboard | TailAdmin - Next.js Dashboard Template",
  description: "This is Next.js Home for TailAdmin Dashboard Template",
};

export default function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12">
        <Summary />         
      </div>

      <div className="col-span-12 xl:col-span-5">
        <DemographicCard />        
        {/* Map */}
      </div>
    
      <div className="col-span-12 xl:col-span-5">
        <PickupTrendsChart />
      </div>


      <div className="col-span-12 xl:col-span-8">
        <TruckSchedule />
      </div>     

    </div>
  );
}
