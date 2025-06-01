"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Bin = {
  bin_id: number;
  label: string;
  latitude: number;
  longitude: number;
  status: number;
  c_id: number;
  bin_plate: string;
  area: string; // Added area field
};

type Truck = {
  truck_id: number;
  truck_plate: string;
  assigned_area: string;
  driver_name?: string;
  is_active: boolean; // Use string to match Supabase boolean
};

type TruckAssignment = {
  assignment_id?: number;
  truck_id: number;
  bin_id: number;
  scheduled_date: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  route_order?: number;
  route_id: number; // Added route_id to link assignment to route
};

type Route = {
  route_id?: number;
  route_name: string;
  truck_id: number;
  scheduled_date: string;
  estimated_duration: number;
  status: 'pending' | 'in_progress' | 'completed';
  assignments: TruckAssignment[];
};

export default function AutoSchedulingPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [schedulingDate, setSchedulingDate] = useState<string>('');
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [showAutoScheduleForm, setShowAutoScheduleForm] = useState(false);
  const [selectedTrucks, setSelectedTrucks] = useState<number[]>([]);

  const centerLat = 1.5341;
  const centerLng = 103.6217;

  // Set today's date by default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSchedulingDate(today);
  }, []);

  // Area definitions based on coordinates
  const getAreaFromCoordinates = (lat: number, lng: number): string => {
    if (lat > centerLat && lng < centerLng) return "Northwest";
    if (lat > centerLat && lng >= centerLng) return "Northeast"; 
    if (lat <= centerLat && lng < centerLng) return "Southwest";
    return "Southeast";
  };

  const getAreaColor = (area: string): string => {
    switch(area) {
      case "Northwest": return "#f43f5e"; // Red
      case "Northeast": return "#3b82f6"; // Blue  
      case "Southwest": return "#10b981"; // Green
      case "Southeast": return "#eab308"; // Yellow
      default: return "#6b7280"; // Gray
    }
  };

  // Fetch data functions
  const fetchBins = async () => {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) {
      console.error("Error fetching bins:", error);
    } else {
      // Add area to each bin based on coordinates
      const binsWithArea = (data || []).map(bin => ({
        ...bin,
        area: getAreaFromCoordinates(bin.latitude, bin.longitude)
      }));
      setBins(binsWithArea);
    }
  };

  const fetchTrucks = async () => {
    const { data, error } = await supabase.from("trucks").select("*");
    if (error) console.error("Error fetching trucks:", error);
    else setTrucks(data || []);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase.from("truck_assignments").select("*");
    if (error) console.error("Error fetching assignments:", error);
    else setAssignments(data || []);
  };

  const fetchRoutes = async () => {
    // Fetch routes with their assignments
    const { data: routeData, error } = await supabase
      .from("routes")
      .select(`
        *,
        truck_assignments(*)
      `);
    
    if (error) {
      console.error("Error fetching routes:", error);
    } else {
      setRoutes(routeData || []);
    }
  };

  useEffect(() => {
    fetchBins();
    fetchTrucks();
    fetchAssignments();
    fetchRoutes();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [centerLng, centerLat],
        zoom: 13,
      });

      map.current.on("load", () => setMapLoaded(true));
    }
  }, []);

  // Add markers to map
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Clear previous markers
    markers.forEach((marker) => marker.remove());
    const newMarkers: mapboxgl.Marker[] = [];

    // Filter bins by selected area if any
    const filteredBins = selectedArea ? bins.filter(bin => bin.area === selectedArea) : bins;

    // Add bin markers
    filteredBins.forEach((bin) => {
      const color = getAreaColor(bin.area || '');
      const isAssigned = assignments.some(a => a.bin_id === bin.bin_id && a.scheduled_date === schedulingDate);
      const scale = isAssigned ? 1.3 : 1;
      const opacity = selectedArea && bin.area !== selectedArea ? 0.3 : 1;

      const marker = new mapboxgl.Marker({ color, scale })
        .setLngLat([bin.longitude, bin.latitude])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div>
              <strong>${bin.label}</strong><br/>
              Area: ${bin.area}<br/>
              Bin Plate: ${bin.bin_plate}<br/>
              Status: ${isAssigned ? '✅ Assigned' : '⏳ Unassigned'}
            </div>
          `)
        )
        .addTo(map.current!);

      marker.getElement().style.opacity = opacity.toString();
      newMarkers.push(marker);
    });

    // Add center marker
    const centerMarker = new mapboxgl.Marker({
      color: "#6F42C1",
      scale: 1.5,
    })
      .setLngLat([centerLng, centerLat])
      .setPopup(new mapboxgl.Popup().setText("Collection Center"))
      .addTo(map.current!);

    newMarkers.push(centerMarker);
    setMarkers(newMarkers);
  }, [bins, mapLoaded, selectedArea, assignments, schedulingDate]);

  // Auto-optimize route using nearest neighbor algorithm
  const optimizeRoute = (binIds: number[]): number[] => {
    if (binIds.length <= 1) return binIds;

    const selectedBins = bins.filter(bin => binIds.includes(bin.bin_id));
    const optimized = [selectedBins[0].bin_id];
    const remaining = selectedBins.slice(1);

    while (remaining.length > 0) {
      const lastBin = bins.find(b => b.bin_id === optimized[optimized.length - 1])!;
      
      let nearestIndex = 0;
      let shortestDistance = getDistance(
        lastBin.latitude, lastBin.longitude,
        remaining[0].latitude, remaining[0].longitude
      );

      for (let i = 1; i < remaining.length; i++) {
        const distance = getDistance(
          lastBin.latitude, lastBin.longitude,
          remaining[i].latitude, remaining[i].longitude
        );
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }

      optimized.push(remaining[nearestIndex].bin_id);
      remaining.splice(nearestIndex, 1);
    }

    return optimized;
  };

  // Calculate distance between two points
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate estimated duration
  const calculateDuration = (binCount: number): number => {
    const baseTime = binCount * 20; // 20 minutes per bin
    const travelTime = binCount * 5; // 5 minutes travel between bins
    return baseTime + travelTime + 30; // +30 minutes for depot travel
  };

  // Handle truck selection
  const handleTruckSelection = (truckId: number) => {
    setSelectedTrucks(prev => {
      if (prev.includes(truckId)) {
        return prev.filter(id => id !== truckId);
      } else {
        return [...prev, truckId];
      }
    });
  };

  // Automatic scheduling algorithm with selected trucks
  const performAutoScheduling = async (date: string) => {
    if (!date) {
      alert("Please select a scheduling date");
      return;
    }

    if (selectedTrucks.length === 0) {
      alert("Please select at least one truck");
      return;
    }

    // Get selected trucks and validate they're available
    const selectedTruckObjects = trucks.filter(truck => 
      selectedTrucks.includes(truck.truck_id) && truck.is_active === true
    );

    if (selectedTruckObjects.length === 0) {
      alert("None of the selected trucks are available");
      return;
    }

    if (selectedTruckObjects.length !== selectedTrucks.length) {
      const unavailableTrucks = selectedTrucks.length - selectedTruckObjects.length;
      if (!confirm(`${unavailableTrucks} selected truck(s) are not available. Continue with ${selectedTruckObjects.length} available trucks?`)) {
        return;
      }
    }

    // Get unassigned bins for the date
    const unassignedBins = bins.filter(bin => 
      !assignments.some(a => a.bin_id === bin.bin_id && a.scheduled_date === date)
    );

    if (unassignedBins.length === 0) {
      alert("No unassigned bins for the selected date");
      return;
    }

    // Group bins by area to match with trucks
    const binsByArea = unassignedBins.reduce((acc, bin) => {
      const area = bin.area || 'Unknown';
      if (!acc[area]) acc[area] = [];
      acc[area].push(bin);
      return acc;
    }, {} as Record<string, Bin[]>);

    const newAssignments: Omit<TruckAssignment, 'assignment_id'>[] = [];
    const newRoutes: Omit<Route, 'route_id'>[] = [];

    // Calculate bins per truck
    const totalBins = unassignedBins.length;
    const binsPerTruck = Math.ceil(totalBins / selectedTruckObjects.length);

    let binIndex = 0;

    // Assign bins to selected trucks
    for (let i = 0; i < selectedTruckObjects.length && binIndex < unassignedBins.length; i++) {
      const truck = selectedTruckObjects[i];
      
      // Try to get bins from the same area as truck first, then others
      const truckAreaBins = binsByArea[truck.assigned_area] || [];
      const otherAreaBins = Object.entries(binsByArea)
        .filter(([area]) => area !== truck.assigned_area)
        .flatMap(([, bins]) => bins);

      // Combine prioritizing truck's area
      const availableBins = [...truckAreaBins, ...otherAreaBins]
        .filter(bin => !newAssignments.some(a => a.bin_id === bin.bin_id));

      // Take up to binsPerTruck bins for this truck
      const truckBins = availableBins.slice(0, Math.min(binsPerTruck, availableBins.length));

      if (truckBins.length === 0) continue;

      // Optimize route for this truck
      const optimizedBinIds = optimizeRoute(truckBins.map(b => b.bin_id));
      
      // Create assignments
      const truckAssignments = optimizedBinIds.map((binId, index) => ({
        truck_id: truck.truck_id,
        bin_id: binId,
        scheduled_date: date,
        status: 'scheduled' as const,
        route_id: index + 1,
      }));

      newAssignments.push(...truckAssignments);

      // Create route
      const primaryArea = truck.assigned_area;
      const route: Omit<Route, 'route_id'> = {
        route_name: `${primaryArea} - ${truck.truck_plate} - ${new Date(date).toLocaleDateString()}`,
        truck_id: truck.truck_id,
        scheduled_date: date,
        estimated_duration: calculateDuration(truckBins.length),
        status: 'pending',
        assignments: truckAssignments as TruckAssignment[],
      };

      newRoutes.push(route);
      binIndex += truckBins.length;
    }

    // Save to database
    try {
      // Insert assignments
      const { error: assignmentError } = await supabase
        .from("truck_assignments")
        .insert(newAssignments);

      if (assignmentError) throw assignmentError;

      // Insert routes
      const { error: routeError } = await supabase
        .from("routes")
        .insert(newRoutes.map(r => ({
          route_name: r.route_name,
          truck_id: r.truck_id,
          scheduled_date: r.scheduled_date,
          estimated_duration: r.estimated_duration,
          status: r.status,
        })));

      if (routeError) throw routeError;

      alert(`Auto-scheduling completed!\n${newAssignments.length} bins assigned to ${newRoutes.length} trucks.\nRemaining unassigned bins: ${totalBins - newAssignments.length}`);
      
      // Refresh data
      await fetchAssignments();
      await fetchRoutes();
      setShowAutoScheduleForm(false);
      setSelectedTrucks([]);
      
    } catch (error) {
      console.error("Error saving schedule:", error);
      alert("Failed to save schedule. Please try again.");
    }
  };

  // Show route on map
  const showRouteOnMap = async (route: Route) => {
    if (!map.current) return;

    // Clear existing route
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    const routeBins = bins.filter(bin => 
      route.assignments.some(a => a.bin_id === bin.bin_id)
    );
    
    // Sort by route order
    routeBins.sort((a, b) => {
      const orderA = route.assignments.find(ass => ass.bin_id === a.bin_id)?.route_order || 0;
      const orderB = route.assignments.find(ass => ass.bin_id === b.bin_id)?.route_order || 0;
      return orderA - orderB;
    });

    const coordinates = routeBins.map(bin => [bin.longitude, bin.latitude]);
    
    // Add center as start and end point
    coordinates.unshift([centerLng, centerLat]);
    coordinates.push([centerLng, centerLat]);

    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    setActiveRoute(route);
  };

  // Get unique areas
  const areas = [...new Set(bins.map(bin => bin.area).filter(Boolean))];
  const todayDate = new Date().toISOString().split('T')[0];

  // Get available trucks
  const availableTrucks = trucks.filter(truck => truck.is_active === true);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4 min-h-[800px]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Auto Scheduling & Routing</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAutoScheduleForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            🤖 Auto Schedule
          </button>
          <button
            onClick={() => {
              setSelectedArea('');
              setActiveRoute(null);
              if (map.current?.getSource('route')) {
                map.current.removeLayer('route');
                map.current.removeSource('route');
              }
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Clear View
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-lg">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Filter by Area:</label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="">All Areas</option>
            {areas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">View Date:</label>
          <input
            type="date"
            value={schedulingDate}
            onChange={(e) => setSchedulingDate(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          />
        </div>
        <div className="text-sm text-gray-600">
          Showing: {selectedArea ? bins.filter(b => b.area === selectedArea).length : bins.length} bins
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        {/* Map */}
        <div className="lg:col-span-2">
          <div ref={mapContainer} className="w-full h-full rounded-xl border border-gray-300" />
        </div>

        {/* Routes & Assignments List */}
        <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-3">Scheduled Routes</h3>
          <div className="space-y-2">
            {routes
              .filter(route => !schedulingDate || route.scheduled_date.startsWith(schedulingDate))
              .map((route) => {
                const truck = trucks.find(t => t.truck_id === route.truck_id);
                return (
                  <div
                    key={route.route_id}
                    className={`p-3 bg-white rounded-lg border cursor-pointer hover:shadow-md ${
                      activeRoute?.route_id === route.route_id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => showRouteOnMap(route)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{route.route_name}</h4>
                        <p className="text-xs text-gray-600">
                          Truck: {truck?.truck_plate} ({truck?.assigned_area})
                        </p>
                        <p className="text-xs text-gray-600">
                          Date: {new Date(route.scheduled_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">
                          Duration: {route.estimated_duration} min
                        </p>
                        <p className="text-xs text-gray-600">
                          Bins: {route.assignments?.length || 0}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        route.status === 'completed' ? 'bg-green-100 text-green-800' :
                        route.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {route.status}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Area Legend */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Area Colors</h4>
            <div className="space-y-1">
              {areas.map(area => (
                <div key={area} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: getAreaColor(area) }}
                  ></div>
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Auto Schedule Form */}
      {showAutoScheduleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[500px] max-w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">🤖 Auto Schedule Routes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Schedule Date</label>
                <input
                  type="date"
                  value={schedulingDate}
                  onChange={(e) => setSchedulingDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Defaults to today's date</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Trucks ({selectedTrucks.length} selected)</label>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {availableTrucks.length === 0 ? (
                    <p className="p-3 text-gray-500 text-sm">No available trucks</p>
                  ) : (
                    availableTrucks.map((truck) => (
                      <div
                        key={truck.truck_id}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                          selectedTrucks.includes(truck.truck_id) ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => handleTruckSelection(truck.truck_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTrucks.includes(truck.truck_id)}
                                onChange={() => handleTruckSelection(truck.truck_id)}
                                className="rounded"
                              />
                              <span className="font-medium text-sm">{truck.truck_plate}</span>
                            </div>
                            <p className="text-xs text-gray-600 ml-6">
                              Area: {truck.assigned_area}
                              {truck.driver_name && ` | Driver: ${truck.driver_name}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {availableTrucks.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Click to select/deselect trucks. Bins will be distributed among selected trucks.
                  </p>
                )}
              </div>

              <div className="bg-blue-50 p-3 rounded-md text-sm">
                <p><strong>Auto-scheduling will:</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Distribute unassigned bins among {selectedTrucks.length || 'selected'} trucks</li>
                  <li>Prioritize bins in each truck's assigned area</li>
                  <li>Optimize routes for efficiency using nearest neighbor</li>
                  <li>Create assignments and routes in the database</li>
                </ul>
                {selectedTrucks.length > 0 && (
                  <p className="mt-2 font-medium">
                    Estimated bins per truck: ~{Math.ceil(bins.filter(bin => 
                      !assignments.some(a => a.bin_id === bin.bin_id && a.scheduled_date === schedulingDate)
                    ).length / selectedTrucks.length)}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAutoScheduleForm(false);
                    setSelectedTrucks([]);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performAutoScheduling(schedulingDate)}
                  disabled={selectedTrucks.length === 0}
                  className={`px-4 py-2 rounded-md ${
                    selectedTrucks.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  🚀 Start Auto Scheduling
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}