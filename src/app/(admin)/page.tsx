import type { Metadata } from "next";
import { Summary } from "@/components/dashboard/Summary";
import React from "react";
import TruckSchedule from "@/components/dashboard/TruckSchedule";
import { TodayStats } from "@/components/dashboard/TodayStats";

export const metadata: Metadata = {
  title:
    "Kutip",
  description: "",
};

export default function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">

      <div className="col-span-12">
        <Summary />            
      </div>

      Today&apos;s summary 
      <div className="col-span-12">
        <TodayStats />
      </div>  

      <div className="col-span-12 xl:col-span-12">
        <TruckSchedule />
      </div>     

    </div>
  );
}
