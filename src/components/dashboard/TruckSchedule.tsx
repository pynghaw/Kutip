"use client";
import React, { useEffect, useState } from "react";

type TruckAssignment = {
  AssignmentID: number;
  TruckID: number;
  DriverName: string;
  PlateNo: string;
  BinLocation: string;
  ScheduledTime: string;
  Status: string;
};

export default function TruckSchedule() {
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch("/api/dashboard/schedule");
        const data: TruckAssignment[] = await res.json();
        setAssignments(data);
      } catch (err) {
        console.error("Failed to load truck schedule", err);
      }
    };

    fetchSchedule();
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Today&apos;s Truck Schedule
      </h3>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full table-auto text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="px-4 py-2">Truck</th>
              <th className="px-4 py-2">Driver</th>
              <th className="px-4 py-2">Bin Location</th>
              <th className="px-4 py-2">Scheduled Time</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-gray-500" colSpan={5}>
                  No truck assignments for today.
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <tr key={assignment.AssignmentID} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">
                    {assignment.PlateNo}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {assignment.DriverName}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {assignment.BinLocation}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(assignment.ScheduledTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        assignment.Status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : assignment.Status === "In Progress"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {assignment.Status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
