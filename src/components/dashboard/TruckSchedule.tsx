"use client";
import React, { useEffect, useState } from "react";

// Updated TruckAssignment type to match the API response structure
type TruckAssignment = {
  assignmentId: number;
  truckId: number | null;
  driverName: string;
  plateNo: string;
  binLabel: string;
  scheduledTime: string;
  status: string;
};


export default function TruckSchedule() {
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch("/api/dashboard/schedule");
        if (!res.ok) { // Add basic error handling for the fetch response
          console.error("Failed to fetch schedule, status:", res.status);
          // Optionally set an error state to display to the user
          return;
        }
        // The API returns an array of objects with camelCase properties directly
        // e.g., { assignmentId, truckId, driverName, plateNo, binLabel, scheduledTime, status }
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
                // Use the correct camelCase 'assignmentId' for the key
                <tr key={assignment.assignmentId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">
                    {assignment.plateNo ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {assignment.driverName ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {assignment.binLabel ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(assignment.scheduledTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${                       
                        assignment.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : assignment.status === "In Progress"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800" // Default for other statuses like "Pending" etc.
                      }`}
                    >
                      {assignment.status}
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
