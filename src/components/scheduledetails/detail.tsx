"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Collection Center coordinates
const COLLECTION_CENTER = {
  lat: 1.5341,
  lng: 103.6217,
  name: "Collection Center"
};

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
  status: 'pending' | 'in_progress' | 'completed';
  total_bins?: number;
  schedule_id?: number;
  started_at?: string;
  completed_at?: string;
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
  routes: (Route & { truck: Truck | null; driver: any | null })[];
  assignments: (TruckAssignment & { bin: Bin | null; truck: Truck | null; driver: any | null })[];
};

type RouteInfo = {
  distance: number;
  duration: number;
  totalStops: number;
  estimatedStartTime?: string;
  estimatedEndTime?: string;
};

type BinWithOrder = Bin & {
  collectionOrder: number;
  distanceFromPrevious?: number;
  estimatedArrivalTime?: string;
};

interface DetailsProps {
  filterByDriver?: boolean;
}

export default function ScheduleDetailPage({ filterByDriver = false }: DetailsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('id');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [scheduleDetails, setScheduleDetails] = useState<ScheduleDetails | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route & { truck: Truck | null; driver: Driver | null } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeBins, setRouteBins] = useState<BinWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [updatingRoute, setUpdatingRoute] = useState<number | null>(null);
  const [routeStartTimes, setRouteStartTimes] = useState<Record<number, string>>({});
  const [showBinDetails, setShowBinDetails] = useState(false);

  useEffect(() => {
    if (!scheduleId || users.length === 0) {
      if (!scheduleId) {
        setError("No schedule ID provided");
        setLoading(false);
      }
      return;
    }
    fetchScheduleDetails();
  }, [scheduleId, users]);

  useEffect(() => {
    if (showMap && mapContainer.current && !map.current) {
      initializeMap();
    }
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [showMap]);

  useEffect(() => {
    if (selectedRoute && map.current && scheduleDetails) {
      displayRouteOnMap();
    }
  }, [selectedRoute, scheduleDetails]);

  // Fetch users with role 'driver' for driver name lookup
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.filter((u: any) => u.role === 'driver'));
        }
      } catch (e) {
        // ignore
      }
    };
    fetchUsers();
  }, []);

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

      if (trucksError) console.warn("Error fetching trucks:", trucksError);
      if (binsError) console.warn("Error fetching bins:", binsError);

      // Combine data, but use users for driver info
      const routesWithTrucksAndDrivers = (routes || []).map(route => {
        const truck = (trucks || []).find(truck => truck.truck_id === route.truck_id) || null;
        const driver = truck ? users.find(u => u.user_id === truck.d_id) || null : null;
        return {
          ...route,
          truck,
          driver
        };
      });

      const assignmentsWithDetails = (assignments || []).map(assignment => {
        const truck = (trucks || []).find(truck => truck.truck_id === assignment.truck_id) || null;
        const driver = truck ? users.find(u => u.user_id === truck.d_id) || null : null;
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

      // Initialize route start times for in-progress routes
      const startTimes: Record<number, string> = {};
      routesWithTrucksAndDrivers.forEach(route => {
        if (route.status === 'in_progress' && route.route_id) {
          startTimes[route.route_id] = route.started_at || new Date().toISOString();
        }
      });
      setRouteStartTimes(startTimes);

    } catch (err) {
      console.error("Error fetching schedule details:", err);
      setError(err instanceof Error ? err.message : "Failed to load schedule details");
    } finally {
      setLoading(false);
    }
  };

  // Calculate optimal route order using nearest neighbor algorithm
  const calculateOptimalRoute = (bins: Bin[]): BinWithOrder[] => {
    if (bins.length === 0) return [];

    const unvisited = [...bins];
    const orderedBins: BinWithOrder[] = [];
    let currentLocation = { lat: COLLECTION_CENTER.lat, lng: COLLECTION_CENTER.lng };

    // Start from collection center and find nearest bin
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = Number.MAX_VALUE;

      unvisited.forEach((bin, index) => {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          bin.latitude,
          bin.longitude
        );
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearestBin = unvisited[nearestIndex];
      orderedBins.push({
        ...nearestBin,
        collectionOrder: orderedBins.length + 1,
        distanceFromPrevious: shortestDistance
      });

      currentLocation = { lat: nearestBin.latitude, lng: nearestBin.longitude };
      unvisited.splice(nearestIndex, 1);
    }

    return orderedBins;
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate route info with timing
  const calculateRouteInfo = async (route: Route & { truck: Truck | null; driver: Driver | null }) => {
    if (!scheduleDetails) return null;

    const routeBinsData = scheduleDetails.assignments
      .filter(assignment => assignment.truck_id === route.truck_id)
      .map(assignment => assignment.bin)
      .filter(bin => bin !== null) as Bin[];

    if (routeBinsData.length === 0) return null;

    // Calculate optimal route order
    const orderedBins = calculateOptimalRoute(routeBinsData);
    setRouteBins(orderedBins);

    // Create coordinates array starting from collection center
    const coordinates: [number, number][] = [];
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);
    
    orderedBins.forEach(bin => {
      coordinates.push([bin.longitude, bin.latitude]);
    });
    
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);

    try {
      const coordinatesString = coordinates.map(coord => coord.join(',')).join(';');
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&steps=true&access_token=${mapboxgl.accessToken}`;
      
      const response = await fetch(directionsUrl);
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const routeData = data.routes[0];
        
        const now = new Date();
        const estimatedStartTime = route.status === 'in_progress' && route.route_id && routeStartTimes[route.route_id] 
          ? new Date(routeStartTimes[route.route_id])
          : now;
        
        const estimatedEndTime = new Date(estimatedStartTime.getTime() + (routeData.duration * 1000));

        // Calculate estimated arrival times for each bin
        const binsWithTiming = orderedBins.map((bin, index) => {
          // Estimate time based on distance and average speed
          const cumulativeTime = index * 10 * 60 * 1000; // 10 minutes per stop estimate
          const arrivalTime = new Date(estimatedStartTime.getTime() + cumulativeTime);
          
          return {
            ...bin,
            estimatedArrivalTime: arrivalTime.toISOString()
          };
        });

        setRouteBins(binsWithTiming);
        
        return {
          distance: routeData.distance / 1000,
          duration: routeData.duration / 60,
          totalStops: orderedBins.length,
          estimatedStartTime: estimatedStartTime.toISOString(),
          estimatedEndTime: estimatedEndTime.toISOString()
        };
      }
    } catch (error) {
      console.error('Error calculating route info:', error);
    }
    
    return null;
  };

const checkAndUpdateScheduleStatus = async (routes: Route[]) => {
  if (!scheduleId || routes.length === 0) return;

  // Determine the appropriate schedule status based on route statuses
  let newScheduleStatus: string;
  
  const routeStatuses = routes.map(route => route.status);
  const completedRoutes = routeStatuses.filter(status => status === 'completed').length;
  const inProgressRoutes = routeStatuses.filter(status => status === 'in_progress').length;
  const pendingRoutes = routeStatuses.filter(status => status === 'pending').length;

  if (completedRoutes === routes.length) {
    newScheduleStatus = 'completed';
  } else if (inProgressRoutes > 0) {
    newScheduleStatus = 'in_progress';
  } else if (pendingRoutes === routes.length) {
    newScheduleStatus = 'pending';
  } else {
    // Fallback to a valid status
    newScheduleStatus = 'pending';
  }

  // Only update if the status has actually changed
  if (scheduleDetails?.status === newScheduleStatus) {
    console.log('Schedule status is already', newScheduleStatus);
    return;
  }

  // Convert scheduleId to number if possible
  const scheduleIdNum = typeof scheduleId === 'string' ? Number(scheduleId) : scheduleId;
  console.log('Converted scheduleId:', scheduleIdNum, 'type:', typeof scheduleIdNum);

  // Check if the schedule exists in the database before updating
  const { data: existingSchedule, error: fetchError } = await supabase
    .from('schedules')
    .select('*')
    .eq('schedule_id', scheduleIdNum)
    .single();
  if (fetchError || !existingSchedule) {
    console.error('Schedule not found in database for scheduleId:', scheduleIdNum, 'Error:', fetchError);
    return;
  }

  if (scheduleDetails?.status !== newScheduleStatus) {
    try {
      console.log('Updating schedule with filter:', { schedule_id: scheduleIdNum }, 'and payload:', { status: newScheduleStatus });
      const updateResponse = await supabase
        .from('schedules')
        .update({ status: newScheduleStatus })
        .eq('schedule_id', scheduleIdNum) as { data: any[] | null, error: any };
      console.log('Supabase update response:', updateResponse);
      const { error: updateError, data: updateData } = updateResponse;
      const dataArray = updateData as any[];

      if (updateError) {
        console.error('Error updating schedule status:', updateError, 'Full response:', updateResponse);
        const errorMsg = updateError.message || updateError.details || updateError.hint || JSON.stringify(updateError) || 'Unknown error from Supabase';
        throw new Error(errorMsg);
      }
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        console.warn('No schedule was updated. The schedule_id may not exist or the status is already set.');
        return;
      }

      console.log(`Schedule status updated to ${newScheduleStatus} successfully`);
      
      // Update local state
      setScheduleDetails(prev => 
        prev ? { ...prev, status: newScheduleStatus } : null
      );

    } catch (error) {
      console.error('Failed to update schedule status:', error);
    }
  }
};
  const initializeMap = () => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [COLLECTION_CENTER.lng, COLLECTION_CENTER.lat],
      zoom: 11
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  };

  const displayRouteOnMap = async () => {
    if (!map.current || !selectedRoute || !scheduleDetails || routeBins.length === 0) return;

    // Clear existing layers and sources
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    const coordinates: [number, number][] = [];
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);
    
    routeBins.forEach(bin => {
      coordinates.push([bin.longitude, bin.latitude]);
    });
    
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);

    // Add collection center marker
    new mapboxgl.Marker({
      color: '#8b5cf6'
    })
      .setLngLat([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${COLLECTION_CENTER.name}</h3>
              <p class="text-sm text-gray-600">Start/End Point</p>
              <p class="text-sm text-gray-600">Coordinates: ${COLLECTION_CENTER.lat.toFixed(4)}, ${COLLECTION_CENTER.lng.toFixed(4)}</p>
            </div>
          `)
      )
      .addTo(map.current!);

    // Add numbered markers for each bin in collection order
    routeBins.forEach((bin, index) => {
      // Create custom marker with number
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.backgroundColor = selectedRoute.status === 'completed' ? '#10b981' : 
                                selectedRoute.status === 'in_progress' ? '#f59e0b' : '#3b82f6';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '12px';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      el.textContent = bin.collectionOrder.toString();

      const marker = new mapboxgl.Marker(el)
        .setLngLat([bin.longitude, bin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-3">
                <h3 class="font-semibold">${bin.label || bin.bin_plate}</h3>
                <p class="text-sm text-gray-600"><strong>Collection Order:</strong> ${bin.collectionOrder} of ${routeBins.length}</p>
                <p class="text-sm text-gray-600"><strong>Area:</strong> ${bin.area}</p>
                <p class="text-sm text-gray-600"><strong>Status:</strong> ${selectedRoute.status}</p>
                ${bin.estimatedArrivalTime ? 
                  `<p class="text-sm text-gray-600"><strong>Est. Arrival:</strong> ${formatTime(bin.estimatedArrivalTime)}</p>` : ''
                }
                ${bin.distanceFromPrevious ? 
                  `<p class="text-sm text-gray-600"><strong>Distance from previous:</strong> ${bin.distanceFromPrevious.toFixed(2)} km</p>` : ''
                }
                <p class="text-sm text-gray-600"><strong>Coordinates:</strong> ${bin.latitude.toFixed(4)}, ${bin.longitude.toFixed(4)}</p>
              </div>
            `)
        )
        .addTo(map.current!);
    });

    if (coordinates.length > 2) {
      try {
        const coordinatesString = coordinates.map(coord => coord.join(',')).join(';');
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&steps=true&access_token=${mapboxgl.accessToken}`;
        
        const response = await fetch(directionsUrl);
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          
          // Calculate route info with timing
          const now = new Date();
          const estimatedStartTime = selectedRoute.status === 'in_progress' && selectedRoute.route_id && routeStartTimes[selectedRoute.route_id]
            ? new Date(routeStartTimes[selectedRoute.route_id])
            : now;
          
          const estimatedEndTime = new Date(estimatedStartTime.getTime() + (route.duration * 1000));
          
          setRouteInfo({
            distance: route.distance / 1000,
            duration: route.duration / 60,
            totalStops: routeBins.length,
            estimatedStartTime: estimatedStartTime.toISOString(),
            estimatedEndTime: estimatedEndTime.toISOString()
          });

          // Add route line to map with status-based color
          const routeColor = selectedRoute.status === 'completed' ? '#10b981' : 
                           selectedRoute.status === 'in_progress' ? '#f59e0b' : '#3b82f6';

          map.current!.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });

          map.current!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': routeColor,
              'line-width': 5,
              'line-opacity': 0.8
            }
          });
        }
      } catch (error) {
        console.error('Error fetching route:', error);
        setRouteInfo(null);
      }
    }

    // Fit map to show all markers
    if (coordinates.length > 0) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      map.current.fitBounds(bounds, {
        padding: 50
      });
    }
  };

  const updateRouteStatus = async (routeId: number, newStatus: 'in_progress' | 'completed') => {
  try {
    setUpdatingRoute(routeId);
    
    // Validate inputs
    if (!routeId || !newStatus) {
      throw new Error('Invalid route ID or status');
    }

    // Check if route exists
    const route = scheduleDetails?.routes.find(r => r.route_id === routeId);
    if (!route) {
      throw new Error('Route not found');
    }

    // Validate status transition
    if (route.status === 'completed') {
      throw new Error('Cannot update status of a completed route');
    }
    
    if (newStatus === 'completed' && route.status !== 'in_progress') {
      throw new Error('Route must be in progress before it can be completed');
    }

    const updateData: any = { status: newStatus };
    
    // Add timestamp fields
    if (newStatus === 'in_progress') {
      const startTime = new Date().toISOString();
      updateData.started_at = startTime;
      setRouteStartTimes(prev => ({
        ...prev,
        [routeId]: startTime
      }));
    } else if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    console.log('Updating route with data:', { routeId, updateData });

    const { data, error } = await supabase
      .from('routes')
      .update(updateData)
      .eq('route_id', routeId)
      .select(); // Add select() to return updated data

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Database error: ${error.message || 'Unknown error'}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No route was updated. Route may not exist.');
    }

    console.log('Route updated successfully:', data);

    // Refresh schedule details
    await fetchScheduleDetails();
    
    // Update selected route if it's the one being updated
    if (selectedRoute && selectedRoute.route_id === routeId) {
      const updatedRoute = { ...selectedRoute, status: newStatus, ...updateData };
      setSelectedRoute(updatedRoute);
      
      // Recalculate route info for the updated route
      const newRouteInfo = await calculateRouteInfo(updatedRoute);
      if (newRouteInfo) {
        setRouteInfo(newRouteInfo);
      }
    }

    // Check if we need to update schedule status after route update
    if (scheduleDetails) {
      const updatedRoutes = scheduleDetails.routes.map(route => 
        route.route_id === routeId ? { ...route, status: newStatus } : route
      );
      await checkAndUpdateScheduleStatus(updatedRoutes);
    }

    // Show success message
    console.log(`Route status updated to ${newStatus} successfully`);

  } catch (error) {
    console.error('Error updating route status:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to update route status. ';
    
    if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Please try again.';
    }
    
    // You might want to use a toast notification instead of alert
    alert(errorMessage);
    
    // Optionally, you could also set an error state for better UX
    // setError(errorMessage);
    
  } finally {
    setUpdatingRoute(null);
  }
};



  const handleViewRoute = async (route: Route & { truck: Truck | null; driver: Driver | null }) => {
    setSelectedRoute(route);
    setShowMap(true);
    
    // Calculate and display route info immediately
    const info = await calculateRouteInfo(route);
    if (info) {
      setRouteInfo(info);
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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60)); // minutes
    return formatDuration(elapsed);
  };

  // Get current driver's user ID
  const getCurrentDriverId = () => {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          return user.user_id;
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
    return null;
  };

  // Filter routes for current driver if filterByDriver is true
  const currentDriverId = getCurrentDriverId();
  const driverRoutes = scheduleDetails && filterByDriver && currentDriverId
    ? scheduleDetails.routes.filter(route => route.truck && route.truck.d_id === currentDriverId)
    : scheduleDetails?.routes || [];

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
      {/* Header Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back to Schedules
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {scheduleDetails.schedule_name}
            </h1>
            <p className="text-gray-600 mt-1">
              {formatDate(scheduleDetails.scheduled_date)}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(scheduleDetails.status)}`}>
              {scheduleDetails.status || 'Active'}
            </div>
            {scheduleDetails.created_at && (
              <p className="text-sm text-gray-500 mt-2">
                Created: {formatDate(scheduleDetails.created_at)} at {formatTime(scheduleDetails.created_at)}
              </p>
            )}
          </div>
        </div>

        {/* Schedule Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{scheduleDetails.total_trucks}</div>
            <div className="text-sm text-gray-600">Total Trucks</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{scheduleDetails.total_bins}</div>
            <div className="text-sm text-gray-600">Total Bins</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{scheduleDetails.total_routes}</div>
            <div className="text-sm text-gray-600">Total Routes</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {scheduleDetails.routes.filter(route => route.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-600">Completed Routes</div>
          </div>
        </div>

        {scheduleDetails.description && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600">{scheduleDetails.description}</p>
          </div>
        )}
      </div>

      {/* Routes Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Routes</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMap(!showMap)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
            <button
              onClick={() => setShowBinDetails(!showBinDetails)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              {showBinDetails ? 'Hide Bin Details' : 'Show Bin Details'}
            </button>
          </div>
        </div>

        {driverRoutes.length > 0 ? (
          <div className="space-y-4">
            {driverRoutes.map((route, index) => {
              const routeBinsForCard = scheduleDetails.assignments
                .filter(assignment => assignment.truck_id === route.truck_id)
                .map(assignment => assignment.bin)
                .filter(bin => bin !== null) as Bin[];

              const orderedBinsForCard = calculateOptimalRoute(routeBinsForCard);

              return (
                <div
                  key={route.route_id || index}
                  className={`border rounded-lg p-4 transition-colors ${
                    selectedRoute?.route_id === route.route_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {route.route_name}
                      </h3>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(route.status)}`}>
                        {route.status}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {route.status === 'pending' && (
                        <button
                          onClick={() => updateRouteStatus(route.route_id!, 'in_progress')}
                          disabled={updatingRoute === route.route_id}
                          className="px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm disabled:opacity-50"
                        >
                          {updatingRoute === route.route_id ? 'Starting...' : 'Start Route'}
                        </button>
                      )}
                      {route.status === 'in_progress' && (
                        <button
                          onClick={() => updateRouteStatus(route.route_id!, 'completed')}
                          disabled={updatingRoute === route.route_id}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                        >
                          {updatingRoute === route.route_id ? 'Completing...' : 'Complete Route'}
                        </button>
                      )}
                      <button
                        onClick={() => handleViewRoute(route)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                      >
                        View Route
                      </button>
                    </div>
                  </div>

                  {/* Route Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Truck</p>
                      <p className="font-medium">
                        {route.truck ? route.truck.plate_no : 'Not assigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Driver</p>
                      <p className="font-medium">
                        {route.driver ? (route.driver.first_name && route.driver.last_name ? `${route.driver.first_name} ${route.driver.last_name}` : route.driver.username) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Bins</p>
                      <p className="font-medium">{routeBinsForCard.length}</p>
                    </div>
                  </div>

                  {/* Timing Information */}
                  {route.status === 'in_progress' && route.route_id && routeStartTimes[route.route_id] && (
                    <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-yellow-800">Route in Progress</p>
                          <p className="text-sm text-yellow-700">
                            Started: {formatTime(routeStartTimes[route.route_id])}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-yellow-800">
                            Elapsed: {getElapsedTime(routeStartTimes[route.route_id])}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {route.status === 'completed' && route.completed_at && (
                    <div className="bg-green-50 p-3 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">Route Completed</p>
                          <p className="text-sm text-green-700">
                            Completed: {formatTime(route.completed_at)}
                          </p>
                        </div>
                        {route.started_at && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-800">
                              Duration: {formatDuration((new Date(route.completed_at).getTime() - new Date(route.started_at).getTime()) / (1000 * 60))}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bin Collection Order */}
                  {(showBinDetails || selectedRoute?.route_id === route.route_id) && orderedBinsForCard.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">
                        Collection Order ({orderedBinsForCard.length} bins)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {orderedBinsForCard.map((bin, binIndex) => (
                          <div
                            key={bin.bin_id}
                            className={`p-3 rounded-lg border-l-4 ${
                              route.status === 'completed' 
                                ? 'border-l-green-500 bg-green-50' 
                                : route.status === 'in_progress'
                                ? 'border-l-yellow-500 bg-yellow-50'
                                : 'border-l-blue-500 bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  route.status === 'completed' 
                                    ? 'bg-green-500' 
                                    : route.status === 'in_progress'
                                    ? 'bg-yellow-500'
                                    : 'bg-blue-500'
                                }`}>
                                  {bin.collectionOrder}
                                </div>
                                <span className="font-medium text-sm">
                                  {bin.label || bin.bin_plate}
                                </span>
                              </div>
                              {route.status === 'completed' && (
                                <div className="text-green-600">
                                  ✓
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              <p><strong>Area:</strong> {bin.area}</p>
                              <p><strong>Coordinates:</strong> {bin.latitude.toFixed(4)}, {bin.longitude.toFixed(4)}</p>
                              {bin.distanceFromPrevious && binIndex > 0 && (
                                <p><strong>Distance:</strong> {bin.distanceFromPrevious.toFixed(2)} km</p>
                              )}
                              {bin.estimatedArrivalTime && route.status !== 'completed' && (
                                <p><strong>Est. Arrival:</strong> {formatTime(bin.estimatedArrivalTime)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No routes assigned to you for this schedule.</p>
          </div>
        )}
      </div>

      {/* Map Section */}
      {showMap && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Route Map</h2>
            {selectedRoute && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Viewing:</span>
                <span className="font-medium">{selectedRoute.route_name}</span>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRoute.status)}`}>
                  {selectedRoute.status}
                </div>
              </div>
            )}
          </div>

          {!selectedRoute ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Select a route to view it on the map</p>
            </div>
          ) : (
            <>
              {/* Route Information Panel */}
              {routeInfo && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Distance</p>
                      <p className="font-semibold">{routeInfo.distance.toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Estimated Duration</p>
                      <p className="font-semibold">{formatDuration(routeInfo.duration)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Stops</p>
                      <p className="font-semibold">{routeInfo.totalStops}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {selectedRoute.status === 'completed' ? 'Completed At' : 
                         selectedRoute.status === 'in_progress' ? 'Started At' : 'Est. Start Time'}
                      </p>
                      <p className="font-semibold">
                        {selectedRoute.status === 'completed' && selectedRoute.completed_at ? 
                          formatTime(selectedRoute.completed_at) :
                         selectedRoute.status === 'in_progress' && selectedRoute.route_id && routeStartTimes[selectedRoute.route_id] ?
                          formatTime(routeStartTimes[selectedRoute.route_id]) :
                         routeInfo.estimatedStartTime ? formatTime(routeInfo.estimatedStartTime) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Map Container */}
              <div 
                ref={mapContainer} 
                className="h-96 rounded-lg border border-gray-300"
                style={{ minHeight: '400px' }}
              />

              {/* Map Legend */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Map Legend</h4>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                    <span>Collection Center (Start/End)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded-full ${
                      selectedRoute.status === 'completed' ? 'bg-green-500' :
                      selectedRoute.status === 'in_progress' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <span>Bins (Numbered by collection order)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-1 ${
                      selectedRoute.status === 'completed' ? 'bg-green-500' :
                      selectedRoute.status === 'in_progress' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <span>Route Path</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Assignments Table (Optional detailed view) */}
      {scheduleDetails.assignments.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Bin Assignments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scheduleDetails.assignments.map((assignment, index) => {
                  const routeForAssignment = scheduleDetails.routes.find(route => route.truck_id === assignment.truck_id);
                  return (
                    <tr key={assignment.assignment_id || index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {assignment.bin ? assignment.bin.label || assignment.bin.bin_plate : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment.bin ? assignment.bin.area : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment.truck ? assignment.truck.plate_no : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment.driver ? (assignment.driver.first_name && assignment.driver.last_name ? `${assignment.driver.first_name} ${assignment.driver.last_name}` : assignment.driver.username) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          routeForAssignment ? getStatusColor(routeForAssignment.status) : 'bg-gray-100 text-gray-800'
                        }`}>
                          {routeForAssignment ? routeForAssignment.status : 'pending'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );}