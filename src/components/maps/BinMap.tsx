"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css'; // Added Mapbox GL CSS

// ✅ Replace with your actual Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Bin = {
  id: number;
  lat: number;
  lng: number;
  label: string;
};

const bins: Bin[] = [
    { id: 1, lat: 1.5341, lng: 103.6217, label: "Bin A - Central Taman U" },
    { id: 2, lat: 1.5352, lng: 103.6245, label: "Bin B - Near Taman U Mart" },
    { id: 3, lat: 1.5320, lng: 103.6190, label: "Bin C - Near McDonald's Taman U" },
    { id: 4, lat: 1.5360, lng: 103.6222, label: "Bin D - Jalan Pendidikan" },
  ];
  

export default function BinMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return; // Only initialize once
  
    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [103.6217, 1.5341], // Taman U
      zoom: 15, // Closer zoom for better visibility
    });
  
    map.current.on("load", () => {
      // ✅ Only run after the map is fully ready
      bins.forEach((bin) => {
        new mapboxgl.Marker()
          .setLngLat([bin.lng, bin.lat])
          .setPopup(new mapboxgl.Popup().setText(bin.label))
          .addTo(map.current!);
      });
    });
  }, []);  

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
