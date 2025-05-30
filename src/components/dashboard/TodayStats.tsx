"use client";
import React, { useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import { ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";

export const TodayStats = () => {
  const [metrics, setMetrics] = useState({ bins: 0, trucks: 0, pickupsToday: 0 });

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
      {/* Bins Metric */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Bins Collected</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {metrics.bins}
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            +100%
          </Badge>
        </div>
      </div>

      {/* Trucks Metric */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Bins Missed</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {metrics.trucks}
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            +1.7%
          </Badge>
        </div>
      </div>
    
    </div>
  );
};
