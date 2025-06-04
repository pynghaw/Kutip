"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";
import "mapbox-gl/dist/mapbox-gl.css";
import TruckIconMarker from "@/components/icon/TruckIconMarker";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Bin = {
  bin_id: number;
  label: string;
  latitude: number;
  longitude: number;
  status_id: number;
  c_id: number;
  bin_plate: string;
  area: number;
};

type Truck = {
  truck_id: number;
  plate_no: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  d_id: number;
};

type bin_status = { status_id: number; status: string };

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [statuses, setStatuses] = useState<bin_status[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [areaFilter, setAreaFilter] = useState<number | null>(null);

  const centerLat = 1.5341;
  const centerLng = 103.6217;

  // Area definitions
  const areaNames = {
    1: "Northwest",
    2: "Northeast", 
    3: "Southwest",
    4: "Southeast"
  };

  const getBinColor = (lat: number, lng: number) => {
    if (lat > centerLat && lng < centerLng) return "#f43f5e"; // Red - NW (Area 1)
    if (lat > centerLat && lng >= centerLng) return "#3b82f6"; // Blue - NE (Area 2)
    if (lat <= centerLat && lng < centerLng) return "#10b981"; // Green - SW (Area 3)
    return "#eab308"; // Yellow - SE (Area 4)
  };

  const fetchBins = async () => {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) {
      console.error("❌ Error fetching bins:", error);
    } else {
      setBins(data);
    }
  };

  const fetchTrucks = async () => {
    const { data, error } = await supabase.from("trucks").select("*");
    if (error) {
        console.error("❌ Error fetching trucks:", error);
    } else {
        setTrucks(data || []);
    };
  }

  const fetchRelatedTables = async () => {
    const { data: statusData } = await supabase.from("bin_status").select("*");
    setStatuses(statusData || []);
  };  

    // Define interfaces for your Mapbox Directions API response
    interface MapboxCoordinate extends Array<number> {
    0: number; // longitude
    1: number; // latitude
    length: 2 | 3; // Can be [lng, lat] or [lng, lat, alt]
    }

    interface MapboxRouteGeometry {
    type: "LineString";
    coordinates: MapboxCoordinate[]; // This types 'route' correctly
    }

    interface MapboxRoute {
    geometry: MapboxRouteGeometry;
    // ... other route properties like duration, distance, etc.
    }

    interface MapboxDirectionsResponse {
    routes: MapboxRoute[];
    waypoints?: any[]; // Add other properties as needed
    code?: string;
    uuid?: string;
    }

  async function simulateTruckMovement(truck: Truck, destination: [number, number]) {
    const start = [truck.longitude, truck.latitude];
    const end = destination;

    const query = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
    );

    const data: MapboxDirectionsResponse = await query.json();

    // Basic error check for routes
    if (!data.routes || data.routes.length === 0) {
      console.error("❌ No route found for the given coordinates.");
      return;
    }
    const route = data.routes[0].geometry.coordinates;

    const routeFeature: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {}, // <-- ADD THIS LINE
      geometry: {
        type: 'LineString',
        coordinates: route,
      },
    };

    // Draw the route
    if (map.current?.getSource('route')) {
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(routeFeature);
    } else {
      map.current?.addSource('route', {
        type: 'geojson',
        data: routeFeature,
      });
      map.current?.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#06b6d4', 'line-width': 4 },
      });
    }

    // Animate the truck
    const animatedTruckMarker = new mapboxgl.Marker({ element: TruckIconMarker({ color: "#FF0000"}) })
    .setLngLat(start as [number, number])
    .addTo(map.current!);


    let i = 0;
    const interval = 1000; // milliseconds delay between steps

    function moveSlowly() {
    if (i < route.length) {
        animatedTruckMarker.setLngLat(route[i] as [number, number]);
        i++;
        setTimeout(moveSlowly, interval); // add delay
    }
    }
    moveSlowly();
  }

  function clearRoute() {
    if (!map.current) return;

    if (map.current.getLayer("route")) {
      map.current.removeLayer("route");
    }
    if (map.current.getSource("route")) {
      map.current.removeSource("route");
    }

    // Optional: If you saved animatedTruckMarker to state or ref, remove it like this:
    // animatedTruckMarker.remove();
  }

  useEffect(() => {
    fetchBins();
    fetchRelatedTables();
    fetchTrucks();
  }, []);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [centerLng, centerLat],
        zoom: 15,
      });

      map.current.on("load", () => setMapLoaded(true));
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Clear previous markers
    markers.forEach((marker) => marker.remove());
    const newMarkers: mapboxgl.Marker[] = [];

    // Filter bins based on area filter
    const filteredBins = areaFilter ? bins.filter(bin => bin.area === areaFilter) : bins;

    trucks.forEach((truck) => {
        const popupContent = `
            <div>
            <strong>Truck Plate:</strong> ${truck.plate_no}<br/>
            Status: <span style="font-weight: bold; color: ${truck.is_active ? '#10b981' : '#ef4444'};">
                ${truck.is_active ? "Active" : "Inactive"}
            </span>
            </div>
        `;

        const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 25,
        }).setHTML(popupContent);

        const markerElement = TruckIconMarker({ color: "#0000FF"}); // Get the div element

        // Attach popup events
        markerElement.addEventListener("mouseenter", () => {
            popup.addTo(map.current!).setLngLat([truck.longitude, truck.latitude]);
        });
        markerElement.addEventListener("mouseleave", () => {
            popup.remove();
        });

        // Use it in the marker
        const marker = new mapboxgl.Marker({ element: markerElement })
        .setLngLat([truck.longitude, truck.latitude])
        .addTo(map.current!);

        marker.getElement().style.zIndex = "10";

        newMarkers.push(marker);
    });


    filteredBins.forEach((bin) => {
      const color = getBinColor(bin.latitude, bin.longitude);
      const status = statuses.find((s) => s.status_id == bin.status_id)?.status || "Unknown";
      const isActive = status.toLowerCase() === "active";
      const statusColor = isActive ? "#10b981" : "#ef4444";
      const areaName = areaNames[bin.area as keyof typeof areaNames] || `Area ${bin.area}`;

      const popupContent = `
        <div>
          <strong>${bin.label}</strong><br/>
          Status:<span style="color: ${statusColor}; font-weight: bold;"> ${status}</span><br/>
          Bin Plate: ${bin.bin_plate}<br/>
          Area: <span style="font-weight: bold;">${areaName} (${bin.area})</span>
        </div>
      `;

      // Create marker with normal Mapbox marker (colored based on area, bigger size)
      const marker = new mapboxgl.Marker({ 
        color: color,
        scale: 1  // Makes marker 1.5x bigger
      })
        .setLngLat([bin.longitude, bin.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(popupContent))
        .addTo(map.current!);

                
      marker.getElement().addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        const confirmDelete = confirm(`Delete bin "${bin.label}"?`);
        if (confirmDelete) {
          const { error } = await supabase.from("bins").delete().eq("bin_id", bin.bin_id);
          if (error) {
            console.error("❌ Error deleting bin:", error);
            alert("Failed to delete bin.");
          } else {
            alert(`🗑️ Bin "${bin.label}" deleted.`);
            await fetchBins();
          }
        }
      });

      marker.getElement().style.zIndex = "1";

      newMarkers.push(marker);
    });

    // Add center marker (different color to distinguish it, bigger size)
    const centerMarker = new mapboxgl.Marker({ 
      color: "#6F42C1",
      scale: 1.5 // Makes marker 1.5x bigger
    })
      .setLngLat([centerLng, centerLat])
      .setPopup(new mapboxgl.Popup().setText("Bin Collection Center"))
      .addTo(map.current!);

    newMarkers.push(centerMarker);

    setMarkers(newMarkers);
  }, [bins, trucks, mapLoaded, statuses, areaFilter]);

  

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-300">
        
      {/* Controls Row */}
      <div className="absolute z-10 top-4 left-4 flex gap-2">
        <button
        onClick={() => simulateTruckMovement(trucks[0], [103.6217, 1.5441])} // Example destination
        className="px-3 py-2 bg-green-500 text-white rounded-md text-sm"
        >
        Simulate Truck Move
        </button>
                <button
          onClick={clearRoute}
          className="px-3 py-2 bg-red-500 text-white rounded-md text-sm"
        >
          Clear Route
        </button>

        
        {/* Area Filter Dropdown */}
        <select
          value={areaFilter || ""}
          onChange={(e) => setAreaFilter(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm"
        >
          <option value="">All Areas</option>
          <option value="1">Area 1 - Northwest</option>
          <option value="2">Area 2 - Northeast</option>
          <option value="3">Area 3 - Southwest</option>
          <option value="4">Area 4 - Southeast</option>
        </select>
      </div>

      {/* Bin Count Display */}
      <div className="absolute z-10 top-16 left-4 bg-white px-3 py-1 rounded-md shadow-sm border text-sm">
        {areaFilter ? (
          <span>
            Showing {bins.filter(bin => bin.area === areaFilter).length} bins in {areaNames[areaFilter as keyof typeof areaNames]}
          </span>
        ) : (
          <span>Showing {bins.length} bins (All Areas)</span>
        )}
      </div>

      {/* Area Legend - Simplified for normal markers */}
      <div className="absolute z-10 top-4 right-4 bg-white shadow-lg p-3 rounded-lg border">
        <h3 className="text-sm font-bold mb-2">Area Colors</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#f43f5e" }}></div>
            <span className={areaFilter === 1 ? 'font-bold' : ''}>Area 1 - Northwest</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#3b82f6" }}></div>
            <span className={areaFilter === 2 ? 'font-bold' : ''}>Area 2 - Northeast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#10b981" }}></div>
            <span className={areaFilter === 3 ? 'font-bold' : ''}>Area 3 - Southwest</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#eab308" }}></div>
            <span className={areaFilter === 4 ? 'font-bold' : ''}>Area 4 - Southeast</span>
          </div>
          <hr className="my-2"/>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#6F42C1" }}></div>
            <span>Collection Center</span>
          </div>
        </div>
      </div>

      <div ref={mapContainer} className="w-full h-full" />
      <style jsx global>{`
        .mapboxgl-popup {
            z-index: 9999 !important;
        }
        .mapboxgl-popup-content {
            z-index: 9999 !important;
            position: relative;
        }
        `}</style>

    </div>    
  );
}