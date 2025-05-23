"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MoreDotIcon } from "@/icons";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";

// Dynamically import ApexCharts (for Next.js SSR)
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function PickupTrendsChart() {
  const [isOpen, setIsOpen] = useState(false);
  const [pickupData, setPickupData] = useState<number[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  type PickupTrend = {
    date: string;
    count: number;
    };


  // Fetch pickup trends from API
  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const res = await fetch("/api/dashboard/pickup-trends");
        const data: PickupTrend[] = await res.json();  // ✅ Use the type here

        setDates(
          data.map((item) => {
            const date = new Date(item.date);
            return date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short", // e.g. Jan, Feb, Mar
            });
          })
        );
        
      setPickupData(data.map((item) => item.count));
      } catch (err) {
        console.error("Failed to fetch pickup trends", err);
      }
    };

    fetchTrends();
  }, []);

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "30%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: dates,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },    
    grid: {
      yaxis: { lines: { show: true } },
    },
    fill: { opacity: 1 },
    tooltip: {
      x: { show: true },
      y: {
        formatter: (val: number) => `${val} pickups`,
      },
    },
  };

  const series = [
    {
      name: "Pickups",
      data: pickupData,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Pickup Trends (Last 7 Days)
        </h3>
        <div className="relative inline-block">
          <button onClick={() => setIsOpen(!isOpen)} className="dropdown-toggle">
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
          <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="w-40 p-2">
            <DropdownItem onItemClick={() => setIsOpen(false)} className="text-gray-500 dark:text-gray-400">
              View More
            </DropdownItem>
            <DropdownItem onItemClick={() => setIsOpen(false)} className="text-gray-500 dark:text-gray-400">
              Export
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          <ReactApexChart options={options} series={series} type="bar" height={180} />
        </div>
      </div>
    </div>
  );
}
