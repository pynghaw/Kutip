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

type RouteInfo = {
  distance: number;
  duration: number;
  totalStops: number;
};

export default function ScheduleDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('id');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [scheduleDetails, setScheduleDetails] = useState<ScheduleDetails | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route & { truck: Truck | null; driver: Driver | null } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [updatingRoute, setUpdatingRoute] = useState<number | null>(null);

  useEffect(() => {
    if (!scheduleId) {
      setError("No schedule ID provided");
      setLoading(false);
      return;
    }

    fetchScheduleDetails();
  }, [scheduleId]);

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

  const initializeMap = () => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [COLLECTION_CENTER.lng, COLLECTION_CENTER.lat], // Center on collection center
      zoom: 11
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  };

  const displayRouteOnMap = async () => {
    if (!map.current || !selectedRoute || !scheduleDetails) return;

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

    // Get bins for this route's truck
    const routeBins = scheduleDetails.assignments
      .filter(assignment => assignment.truck_id === selectedRoute.truck_id)
      .map(assignment => assignment.bin)
      .filter(bin => bin !== null);

    if (routeBins.length === 0) {
      return;
    }

    // Create coordinates array starting from collection center
    const coordinates: [number, number][] = [];
    
    // Start from collection center
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);
    
    // Add all bin coordinates
    routeBins.forEach(bin => {
      if (bin) {
        coordinates.push([bin.longitude, bin.latitude]);
      }
    });
    
    // Return to collection center
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);

    // Add collection center marker
    new mapboxgl.Marker({
      color: '#8b5cf6' // Purple for collection center
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

    // Add markers for each bin
    routeBins.forEach((bin, index) => {
      if (bin) {
        const marker = new mapboxgl.Marker({
          color: '#3b82f6' // Blue for bins
        })
          .setLngLat([bin.longitude, bin.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div class="p-2">
                  <h3 class="font-semibold">${bin.label || bin.bin_plate}</h3>
                  <p class="text-sm text-gray-600">Stop ${index + 1} of ${routeBins.length}</p>
                  <p class="text-sm text-gray-600">Area: ${bin.area}</p>
                  <p class="text-sm text-gray-600">Coordinates: ${bin.latitude.toFixed(4)}, ${bin.longitude.toFixed(4)}</p>
                </div>
              `)
          )
          .addTo(map.current!);
      }
    });

    if (coordinates.length > 2) {
      try {
        // Get route from Mapbox Directions API
        const coordinatesString = coordinates.map(coord => coord.join(',')).join(';');
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&steps=true&access_token=${mapboxgl.accessToken}`;
        
        const response = await fetch(directionsUrl);
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          
          // Set route information
          setRouteInfo({
            distance: route.distance / 1000, // Convert to kilometers
            duration: route.duration / 60, // Convert to minutes
            totalStops: routeBins.length
          });

          // Add route line to map
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
              'line-color': '#3b82f6',
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
      
      const { error } = await supabase
        .from('routes')
        .update({ status: newStatus })
        .eq('route_id', routeId);

      if (error) {
        throw error;
      }

      // Refresh schedule details
      await fetchScheduleDetails();
      
      // Update selected route if it's the one being updated
      if (selectedRoute && selectedRoute.route_id === routeId) {
        setSelectedRoute(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating route status:', error);
      alert('Failed to update route status. Please try again.');
    } finally {
      setUpdatingRoute(null);
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
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Schedules
        </button>
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(scheduleDetails.status)}`}>
            {scheduleDetails.status || 'Active'}
          </span>
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{scheduleDetails.schedule_name}</h1>
        <p className="text-gray-600 mb-4">{scheduleDetails.description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{formatDate(scheduleDetails.scheduled_date)}</div>
            <div className="text-sm text-gray-600">Scheduled Date</div>
          </div>
        </div>
      </div>
    </div>

    {/* Route Information Section - Outside Map */}
    {selectedRoute && routeInfo && (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Route Information: {selectedRoute.route_name || `Route ${selectedRoute.route_id}`}
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRoute.status)}`}>
            {selectedRoute.status}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{routeInfo.distance.toFixed(1)} km</div>
            <div className="text-sm text-gray-600">Total Distance</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{formatDuration(routeInfo.duration)}</div>
            <div className="text-sm text-gray-600">Estimated Duration</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{routeInfo.totalStops}</div>
            <div className="text-sm text-gray-600">Total Stops</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{routeInfo.totalStops + 1}</div>
            <div className="text-sm text-gray-600">Total Waypoints</div>
          </div>
        </div>

        {/* Driver and Truck Info */}
        {selectedRoute.truck && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Assignment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Assigned Truck</div>
                <div className="text-lg font-semibold text-gray-900">{selectedRoute.truck.plate_no}</div>
              
              </div>
              {selectedRoute.driver && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Assigned Driver</div>
                  <div className="text-lg font-semibold text-gray-900">{selectedRoute.driver.d_name}</div>
                  <div className="text-sm text-gray-600">Driver ID: {selectedRoute.driver.d_id}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}

    {/* Map Section */}
    {showMap && (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Route Visualization</h2>
          {!selectedRoute && (
            <p className="text-gray-600">Select a route from the list below to view it on the map.</p>
          )}
        </div>
        
        <div className="relative">
          <div
            ref={mapContainer}
            className="w-full h-96 rounded-lg border border-gray-300"
          />
        </div>
      </div>
    )}

    {/* Routes Section */}
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Routes</h2>
      
      {scheduleDetails.routes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No routes found for this schedule.
        </div>
      ) : (
        <div className="space-y-4">
          {scheduleDetails.routes.map((route) => {
            const routeAssignments = scheduleDetails.assignments.filter(
              assignment => assignment.truck_id === route.truck_id
            );
            
            return (
              <div
                key={route.route_id}
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  selectedRoute?.route_id === route.route_id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => {
                  setSelectedRoute(route);
                  if (!showMap) setShowMap(true);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {route.route_name || `Route ${route.route_id}`}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(route.status)}`}>
                      {route.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {route.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateRouteStatus(route.route_id!, 'in_progress');
                        }}
                        disabled={updatingRoute === route.route_id}
                        className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                      >
                        {updatingRoute === route.route_id ? 'Starting...' : 'Start Route'}
                      </button>
                    )}
                    
                    {route.status === 'in_progress' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateRouteStatus(route.route_id!, 'completed');
                        }}
                        disabled={updatingRoute === route.route_id}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {updatingRoute === route.route_id ? 'Completing...' : 'Complete Route'}
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setSelectedRoute(route);
                        if (!showMap) setShowMap(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      View Route
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Truck:</span>
                    <div className="font-medium">
                      {route.truck ? route.truck.plate_no : 'Not assigned'}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Driver:</span>
                    <div className="font-medium">
                      {route.driver ? route.driver.d_name : 'Not assigned'}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Bins:</span>
                    <div className="font-medium">{routeAssignments.length} bins</div>
                  </div>
                </div>

                {/* Bin Details for Selected Route */}
                {selectedRoute?.route_id === route.route_id && routeAssignments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <h4 className="font-medium text-gray-900 mb-2">Assigned Bins:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {routeAssignments.map((assignment, index) => (
                        <div
                          key={assignment.assignment_id}
                          className="bg-white border border-gray-200 rounded p-2 text-sm"
                        >
                          <div className="font-medium">
                            Stop {index + 1}: {assignment.bin?.label || assignment.bin?.bin_plate}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {assignment.bin?.area}
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
      )}
    </div>
  </div>
);}