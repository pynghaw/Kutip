"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Bin = {
  bin_id: number;
  label: string;
  latitude: number;
  longitude: number;
  status_id: number;
  c_id: number;
  bin_plate: string;
  area: string;
};

type Driver = {
  d_id: number;
  d_name: string;
};

type Truck = {
  truck_id: number;
  plate_no: string;
  assigned_area: string;
  d_id: number;
  driver_name: string;
  is_active: boolean;
};

type TruckAssignment = {
  assignment_id?: number;
  truck_id: number;
  bin_id: number;
  scheduled_date: string;
  schedule_id?: number;
};

type Route = {
  route_id?: number;
  route_name: string;
  truck_id: number;
  scheduled_date: string;
  estimated_duration: number;
  status: 'pending' | 'in_progress' | 'completed';
  total_bins?: number;
  schedule_id?: number;
};

type Schedule = {
  schedule_id?: number;
  schedule_name: string;
  scheduled_date: string;
  created_at?: string;
  total_trucks: number;
  total_bins: number;
  total_routes: number;
  description?: string;
  status?: string;
};

type ScheduleDetails = Schedule & {
  routes: (Route & { truck: Truck | null; driver: Driver | null })[];
  assignments: (TruckAssignment & { bin: Bin | null; truck: Truck | null; driver: Driver | null })[];
};

export default function ScheduleDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('id');

  const [scheduleDetails, setScheduleDetails] = useState<ScheduleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId) {
      setError("No schedule ID provided");
      setLoading(false);
      return;
    }

    fetchScheduleDetails();
  }, [scheduleId]);

  const fetchScheduleDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from("schedules")
        .select("*")
        .eq("schedule_id", scheduleId)
        .single();

      if (scheduleError) {
        throw new Error(`Schedule not found: ${scheduleError.message}`);
      }

      // Fetch routes for this schedule
      const { data: routes, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .eq("schedule_id", scheduleId);

      if (routesError && routesError.code !== 'PGRST116') {
        console.warn("Error fetching routes:", routesError);
      }

      // Fetch assignments for this schedule
      const { data: assignments, error: assignmentsError } = await supabase
        .from("truck_assignments")
        .select("*")
        .eq("schedule_id", scheduleId);

      if (assignmentsError) {
        console.warn("Error fetching assignments:", assignmentsError);
      }

      // Fetch all trucks, bins, and drivers to join data
      const { data: trucks, error: trucksError } = await supabase
        .from("trucks")
        .select("*");

      const { data: bins, error: binsError } = await supabase
        .from("bins")
        .select("*");

      const { data: drivers, error: driversError } = await supabase
        .from("driver")
        .select("*");

      if (trucksError) console.warn("Error fetching trucks:", trucksError);
      if (binsError) console.warn("Error fetching bins:", binsError);
      if (driversError) console.warn("Error fetching drivers:", driversError);

      // Combine data
      const routesWithTrucksAndDrivers = (routes || []).map(route => {
        const truck = (trucks || []).find(truck => truck.truck_id === route.truck_id) || null;
        const driver = truck ? (drivers || []).find(driver => driver.d_id === truck.d_id) || null : null;
        
        return {
          ...route,
          truck,
          driver
        };
      });

      const assignmentsWithDetails = (assignments || []).map(assignment => {
        const truck = (trucks || []).find(truck => truck.truck_id === assignment.truck_id) || null;
        const driver = truck ? (drivers || []).find(driver => driver.d_id === truck.d_id) || null : null;
        
        return {
          ...assignment,
          bin: (bins || []).find(bin => bin.bin_id === assignment.bin_id) || null,
          truck,
          driver
        };
      });

      setScheduleDetails({
        ...schedule,
        routes: routesWithTrucksAndDrivers,
        assignments: assignmentsWithDetails
      });

    } catch (err) {
      console.error("Error fetching schedule details:", err);
      setError(err instanceof Error ? err.message : "Failed to load schedule details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'active':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4 min-h-[600px]">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg">Loading schedule details...</span>
        </div>
      </div>
    );
  }

  if (error || !scheduleDetails) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="text-center py-12">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <p className="text-gray-600 mb-4">{error || "Schedule not found"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{scheduleDetails.schedule_name}</h1>
              <p className="text-sm text-gray-600 mt-1">Schedule Details</p>
            </div>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(scheduleDetails.status)}`}>
            {scheduleDetails.status || 'pending'}
          </span>
        </div>

        {/* Schedule Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-blue-600 text-sm font-medium">Scheduled Date</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">
              {formatDate(scheduleDetails.scheduled_date)}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-green-600 text-sm font-medium">Total Trucks</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">
              {scheduleDetails.total_trucks}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-yellow-600 text-sm font-medium">Total Bins</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">
              {scheduleDetails.total_bins}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-purple-600 text-sm font-medium">Total Routes</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">
              {scheduleDetails.total_routes}
            </div>
          </div>
        </div>

        {scheduleDetails.description && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{scheduleDetails.description}</p>
          </div>
        )}
      </div>

      {/* Routes Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Routes ({scheduleDetails.routes.length})</h2>
        {scheduleDetails.routes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No routes assigned to this schedule</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration (hrs)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scheduleDetails.routes.map((route) => (
                  <tr key={route.route_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {route.route_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {route.truck?.plate_no || 'Not assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {route.driver?.d_name || 'Not assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {route.estimated_duration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(route.status)}`}>
                        {route.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignments Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Truck Assignments ({scheduleDetails.assignments.length})</h2>
        {scheduleDetails.assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No truck assignments for this schedule</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bin Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scheduleDetails.assignments.map((assignment) => (
                  <tr key={assignment.assignment_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {assignment.truck?.plate_no || 'Not assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.driver?.d_name || 'Not assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.bin?.label || assignment.bin?.bin_plate || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.bin?.latitude && assignment.bin?.longitude
                        ? `${assignment.bin.latitude.toFixed(4)}, ${assignment.bin.longitude.toFixed(4)}`
                        : 'Location not available'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.bin?.area || assignment.truck?.assigned_area || 'Not specified'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(assignment.scheduled_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-gray-600 text-sm font-medium">Active Routes</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">
              {scheduleDetails.routes.filter(route => route.status === 'in_progress').length}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-gray-600 text-sm font-medium">Completed Routes</div>
            <div className="text-lg font-semibold text-gray-900 mt-1">
              {scheduleDetails.routes.filter(route => route.status === 'completed').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}