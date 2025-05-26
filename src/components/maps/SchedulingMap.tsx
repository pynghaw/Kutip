"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const bins = [
  { id: 1, lat: 1.5341, lng: 103.6217, label: "Bin A - Central Taman U" },
  { id: 2, lat: 1.5352, lng: 103.6245, label: "Bin B - Near Taman U Mart" },
  { id: 3, lat: 1.5320, lng: 103.6190, label: "Bin C - Near McDonald's Taman U" },
  { id: 4, lat: 1.5360, lng: 103.6222, label: "Bin D - Jalan Pendidikan" },
];

const trucks = [
  { id: 1, name: "Truck 1", startLat: 1.5370, startLng: 103.6200, color: "#3b82f6" }, // Blue
  { id: 2, name: "Truck 2", startLat: 1.5300, startLng: 103.6280, color: "#22c55e" }, // Green
];

export default function SchedulingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedTrucks, setSelectedTrucks] = useState<number[]>([]);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [103.6217, 1.5341],
      zoom: 15,
    });

    map.current.on("load", () => {
      bins.forEach((bin) => {
        new mapboxgl.Marker({ color: "#f97316" }) // orange bin
          .setLngLat([bin.lng, bin.lat])
          .setPopup(new mapboxgl.Popup().setText(bin.label))
          .addTo(map.current!);
      });
    });
  }, []);

  const handleSchedule = async () => {
    if (selectedTrucks.length === 0) return alert("Please select at least one truck.");

    for (const truckId of selectedTrucks) {
      const truck = trucks.find(t => t.id === truckId);
      if (!truck) continue;

      // Add start marker for truck
      new mapboxgl.Marker({ color: truck.color })
        .setLngLat([truck.startLng, truck.startLat])
        .setPopup(new mapboxgl.Popup().setText(`${truck.name} Start`))
        .addTo(map.current!);

      // Generate route (start + bins)
      const allCoords = [[truck.startLng, truck.startLat], ...bins.map(bin => [bin.lng, bin.lat])];
      const coordStr = allCoords.map(coord => coord.join(',')).join(';');

      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordStr}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

      const res = await fetch(url);
      const data = await res.json();

      const routeId = `route-${truck.id}`;
      const routeGeoJSON = data.trips?.[0]?.geometry;

      if (!routeGeoJSON) continue;

      // Add route to map
      if (!map.current!.getSource(routeId)) {
        map.current!.addSource(routeId, {
          type: "geojson",
          data: routeGeoJSON,
        });

        map.current!.addLayer({
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
        (map.current!.getSource(routeId) as mapboxgl.GeoJSONSource).setData(routeGeoJSON);
      }
    }
  };

  const toggleTruck = (id: number) => {
    setSelectedTrucks((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  return (
    <div>
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
          onClick={handleSchedule}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Start Scheduling
        </button>
      </div>

      <div className="w-full h-[500px] rounded-xl overflow-hidden border border-gray-300">
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
}
