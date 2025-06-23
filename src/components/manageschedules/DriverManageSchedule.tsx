"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Calendar from "@/components/ui/Calendar";

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
  routes: (Route & { truck: Truck | null })[];
  assignments: (TruckAssignment & { bin: Bin | null; truck: Truck | null })[];
};

export default function DriverManageSchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleDetails, setScheduleDetails] = useState<ScheduleDetails[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'created'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get current driver's user ID
  const getCurrentDriverId = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.user_id;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    return null;
  };

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSchedules(),
        fetchBins(),
        fetchTrucks(),
        fetchRoutes(),
        fetchAssignments()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("schedules")
        .select("*");
      
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      setSchedules([]);
    }
  };

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase.from("bins").select("*");
      if (error) throw error;
      setBins(data || []);
    } catch (error) {
      console.error("Error fetching bins:", error);
      setBins([]);
    }
  };

  const fetchTrucks = async () => {
    try {
      const { data, error } = await supabase.from("trucks").select("*");
      if (error) throw error;
      setTrucks(data || []);
    } catch (error) {
      console.error("Error fetching trucks:", error);
      setTrucks([]);
    }
  };

  const fetchRoutes = async () => {
    try {
      const { data, error } = await supabase.from("routes").select("*");
      if (error) {
        console.log("Routes table might not exist:", error);
        setRoutes([]);
      } else {
        setRoutes(data || []);
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
      setRoutes([]);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase.from("truck_assignments").select("*");
      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    }
  };

  // Build detailed schedule data
  useEffect(() => {
    const currentDriverId = getCurrentDriverId();
    if (schedules.length > 0 && currentDriverId) {
      const detailed = schedules.map(schedule => {
        // Only include routes for this driver
        const scheduleRoutes = routes
          .filter(route => route.schedule_id === schedule.schedule_id)
          .map(route => {
            const truck = trucks.find(truck => truck.truck_id === route.truck_id) || null;
            return {
              ...route,
              truck
            };
          })
          .filter(route => route.truck && route.truck.d_id === currentDriverId);

        // Only include assignments for this driver's truck(s)
        const scheduleAssignments = assignments
          .filter(assignment => assignment.schedule_id === schedule.schedule_id)
          .map(assignment => {
            const truck = trucks.find(truck => truck.truck_id === assignment.truck_id) || null;
            return {
              ...assignment,
              bin: bins.find(bin => bin.bin_id === assignment.bin_id) || null,
              truck
            };
          })
          .filter(assignment => assignment.truck && assignment.truck.d_id === currentDriverId);

        return {
          ...schedule,
          routes: scheduleRoutes,
          assignments: scheduleAssignments
        };
      });

      // Only keep schedules that have at least one route for this driver
      setScheduleDetails(detailed.filter(s => s.routes.length > 0));
    }
  }, [schedules, routes, assignments, bins, trucks]);

  useEffect(() => {
    fetchData();
  }, []);

  // Navigation function - only view details
  const handleViewDetails = (scheduleId: number) => {
    router.push(`/driver/scheduledetail?id=${scheduleId}`);
  };

  // Filter and sort schedules
  const filteredAndSortedSchedules = scheduleDetails
    .filter(schedule => {
      if (filterDate && !schedule.scheduled_date.includes(filterDate)) return false;
      if (filterStatus && schedule.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          compareValue = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
          break;
        case 'name':
          compareValue = a.schedule_name.localeCompare(b.schedule_name);
          break;
        case 'created':
          compareValue = new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4 min-h-[600px]">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg">Loading schedules...</span>
        </div>
      </div>
    );
  }

  // Today's date in YYYY-MM-DD
  const todayDate = new Date();
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const dd = String(todayDate.getDate()).padStart(2, '0');
  const todayString = `${yyyy}-${mm}-${dd}`;
  const todaySchedules = scheduleDetails.filter(s => s.scheduled_date.startsWith(todayString));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-6">
      {/* Today's Schedule Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Today's Schedule</h2>
        {todaySchedules.length === 0 ? (
          <div className="text-gray-500 text-center py-6 border rounded bg-gray-50">No schedule today</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 mb-2">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {todaySchedules.map(schedule => (
                  <tr key={schedule.schedule_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{schedule.schedule_name}</div>
                      {schedule.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{schedule.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(schedule.status)}`}>{schedule.status || 'pending'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(schedule.schedule_id!)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedules</h1>
          <p className="text-sm text-gray-600 mt-1">
            View your assigned waste collection schedules
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Total: {filteredAndSortedSchedules.length} schedules
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Date
          </label>
          <div className="flex gap-2">
            <Calendar
              value={filterDate}
              onChange={setFilterDate}
              placeholder="Select date to filter"
              className="flex-1"
            />
            <button
              onClick={() => setFilterDate('')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              title="Clear date filter"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort by
          </label>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'created')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Scheduled Date</option>
              <option value="name">Name</option>
              <option value="created">Created Date</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trucks
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bins
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Routes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedSchedules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No schedules found matching your criteria
                </td>
              </tr>
            ) : (
              filteredAndSortedSchedules.map((schedule) => (
                <tr key={schedule.schedule_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {schedule.schedule_name}
                    </div>
                    {schedule.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {schedule.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(schedule.scheduled_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(schedule.status)}`}>
                      {schedule.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {schedule.total_trucks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {schedule.total_bins}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {schedule.total_routes}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(schedule.schedule_id!)}
                      className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md transition-colors"
                    >
                      View Details
                    </button>
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