"use client";
import React, { useEffect, useState } from "react";

// Match updated API structure
type TruckAssignment = {
  plateNo: string;
  driverName: string;
  binId: number;
  scheduledDate: string;
  collectionStatus: string;
};

export default function TruckSchedule() {
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch("/api/dashboard/schedule");
        if (!res.ok) {
          console.error("Failed to fetch schedule, status:", res.status);
          return;
        }
        const data = await res.json();
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
        Latest Truck Schedule
      </h3>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full table-auto text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="px-4 py-2">Truck Plate</th>
              <th className="px-4 py-2">Driver</th>
              <th className="px-4 py-2">Bin ID</th>
              <th className="px-4 py-2">Scheduled Date</th>
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
              assignments.slice(0, 6).map((assignment, index) => (
                <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">
                    {assignment.plateNo}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {assignment.driverName}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {assignment.binId}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(assignment.scheduledDate).toLocaleString("en-MY", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        assignment.collectionStatus === "Collected"
                          ? "bg-green-100 text-green-800"
                          : assignment.collectionStatus === "Missed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {assignment.collectionStatus}
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
