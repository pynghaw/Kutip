import type { Metadata } from "next";
import { Summary } from "@/components/dashboard/Summary";
import React from "react";
import TruckSchedule from "@/components/dashboard/TruckSchedule";
import { TodayStats } from "@/components/dashboard/TodayStats";
import Map from "@/components/dashboard/Map";

export const metadata: Metadata = {
  title: "Kutip - Admin Dashboard",
  description: "Admin dashboard for Kutip waste management system",
};

export default function AdminDashboard() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <h2 className="col-span-12 text-xl font-semibold text-gray-800 mt-4 mb-2">
        Dashboard
      </h2>

      <div className="col-span-12">
        <Summary />            
      </div>

      <h2 className="col-span-12 text-xl font-semibold text-gray-800 mt-4 mb-2">
        Today&apos;s Summary
      </h2>

      <div className="col-span-12 xl:col-span-4">
        <TodayStats />
      </div>  

      <div className="col-span-12 xl:col-span-8">
        <TruckSchedule />
      </div>  

      <h2 className="col-span-12 text-xl font-semibold text-gray-800 mt-4 mb-2">
        Truck&apos;s Live Location 
      </h2>

      <div className="col-span-12 xl:col-span-12">
        <Map />
      </div>         

    </div>
  );
} 