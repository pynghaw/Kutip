"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/lib/supabaseClient";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const trucks = [
  { id: 1, name: "Truck 1", startLat: 1.5370, startLng: 103.6200, color: "#3b82f6" }, // Blue
  { id: 2, name: "Truck 2", startLat: 1.5300, startLng: 103.6280, color: "#22c55e" }, // Green
];

type Bin = {
  id: number;
  latitude: number;
  longitude: number;
  label: string;
};

export default function SchedulingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedTrucks, setSelectedTrucks] = useState<number[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showMap, setShowMap] = useState(false); // 👈 Control when to show the map

  // Fetch bins from Supabase
  useEffect(() => {
    const fetchBins = async () => {
      const { data, error } = await supabase.from("bins").select("*");
      if (error) console.error("Error fetching bins:", error);
      else setBins(data);
    };

    fetchBins();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !showMap) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [103.6217, 1.5341],
      zoom: 15,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
    });
  }, [showMap]);

  // Add markers after map + bins are ready
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    bins.forEach((bin) => {
      new mapboxgl.Marker({ color: "#f97316" }) // Orange
        .setLngLat([bin.longitude, bin.latitude])
        .setPopup(new mapboxgl.Popup().setText(bin.label))
        .addTo(map.current!);
    });
  }, [bins, mapLoaded]);

  const runScheduling = async () => {
    if (!map.current || selectedTrucks.length === 0) return;

    for (const truckId of selectedTrucks) {
      const truck = trucks.find((t) => t.id === truckId);
      if (!truck) continue;

      new mapboxgl.Marker({ color: truck.color })
        .setLngLat([truck.startLng, truck.startLat])
        .setPopup(new mapboxgl.Popup().setText(`${truck.name} Start`))
        .addTo(map.current);

      const allCoords = [[truck.startLng, truck.startLat], ...bins.map((bin) => [bin.longitude, bin.latitude])];
      const coordStr = allCoords.map((coord) => coord.join(',')).join(';');

      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordStr}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      const routeGeoJSON = data.trips?.[0]?.geometry;
      const routeId = `route-${truck.id}`;

      if (!routeGeoJSON) continue;

      const source = map.current.getSource(routeId);
      if (!source) {
        map.current.addSource(routeId, {
          type: "geojson",
          data: routeGeoJSON,
        });
        map.current.addLayer({
          id: routeId,
          type: "line",
          source: routeId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": truck.color,
            "line-width": 4,
          },
        });
      } else {
        (source as mapboxgl.GeoJSONSource).setData(routeGeoJSON);
      }
    }
  };

  const handleStartScheduling = () => {
    if (selectedTrucks.length === 0) {
      alert("Please select at least one truck.");
      return;
    }
    setShowMap(true); // 👈 Show the map and initialize it
  };

  useEffect(() => {
    if (showMap) runScheduling(); // 👈 Run routes only after map shown
  }, [showMap]);

  const toggleTruck = (id: number) => {
    setSelectedTrucks((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  return (
    <div>
      {!showMap ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Select Trucks</h2>
          <div className="flex gap-3">
            {trucks.map((truck) => (
              <label key={truck.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selectedTrucks.includes(truck.id)}
                  onChange={() => toggleTruck(truck.id)}
                />
                <span className="text-sm" style={{ color: truck.color }}>{truck.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleStartScheduling}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Start Scheduling
          </button>
        </div>
      ) : (
        <div className="w-full h-[500px] rounded-xl overflow-hidden border border-gray-300">
          <div ref={mapContainer} className="w-full h-full" />
        </div>
      )}
    </div>
  );
}
