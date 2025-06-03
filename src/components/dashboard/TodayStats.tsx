"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

// Dynamically import ApexChart to avoid SSR issues
const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const TodayStats = () => {
  const [metrics, setMetrics] = useState({
    successfulPickups: 0,
    missedPickups: 0,
    pickupsToday: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/dashboard/todaystats");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to load metrics:", err);
      }
    };

    fetchMetrics();
  }, []);
  

  const pieOptions: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "pie",
      toolbar: { show: false },
    },
    labels: ["Successful", "Missed"],
    colors: ["#465fff", "#ef4444"],
    legend: {
      position: "bottom" as const,
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      theme: "light", // light background like your screenshot
      fillSeriesColor: false,
      marker: {
        show: true, // shows the dot
      },
      y: {
        formatter: (value: number) => `${value} Bins`,
      },
    },
  };

  const pieSeries = [
    metrics.successfulPickups,
    metrics.missedPickups,
  ];

  return (
    <div className="gap-4 md:gap-6">  
      {/* Pie Chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <h4 className="font-semibold text-gray-800 mb-4 dark:text-white/90">
          Pickup Status 
        </h4>
        <ApexChart
          options={pieOptions}
          series={pieSeries}
          type="pie"
          width="100%"
        />
      </div>
    </div>
  );
};
