"use client";
import React, { useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import { ArrowUpIcon, ArrowDownIcon } from "@/icons";
import Image from "next/image";

export const Summary = () => {
  const [metrics, setMetrics] = useState({ bins: 0, trucks: 0, pickupsToday: 0 });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/dashboard/summary");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to load metrics:", err);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">  
      {/* Bins Metric */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-39">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-gray-100 rounded-xl dark:bg-gray-800">
            <Image
              src="/images/dashboard/bin.png"   
              alt="Bin Icon"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Bins</span>
        </div>

        <div className="flex items-end justify-between mt-5">
          <h4 className="font-bold text-gray-800 text-title-sm dark:text-white/90">
            {metrics.bins}
          </h4>
          <Badge color="success">
            <ArrowUpIcon />
            +100%
          </Badge>
        </div>
      </div>

      {/* Trucks Metric */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-39">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-gray-100 rounded-xl dark:bg-gray-800">
            <Image
              src="/images/dashboard/truck.png"   
              alt="Truck Icon"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Trucks</span>
        </div>

        <div className="flex items-end justify-between mt-5">
          <h4 className="font-bold text-gray-800 text-title-sm dark:text-white/90">
            {metrics.trucks}
          </h4>
          <Badge color="success">
            <ArrowDownIcon />
            -21%
          </Badge>
        </div>
      </div>

      {/* Total Pickups Metric */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-39">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-gray-100 rounded-xl dark:bg-gray-800">
            <Image
              src="/images/dashboard/pickup.png"   
              alt="Pickup Icon"
              width={25}
              height={25}
              className="object-contain"
            />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Pickups</span>
        </div>

        <div className="flex items-end justify-between mt-5">
          <h4 className="font-bold text-gray-800 text-title-sm dark:text-white/90">
            {metrics.pickupsToday}
          </h4>
          <Badge color="success">
            <ArrowUpIcon />
            +77%
          </Badge>
        </div>
      </div>
    </div>
  );
};
