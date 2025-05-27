"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Bin = {
  id: number;
  latitude: number;
  longitude: number;
  label: string;
};

export default function BinMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Fetch bins from Supabase
  useEffect(() => {
    const fetchBins = async () => {
      const { data, error } = await supabase.from("bins").select("*");
      if (error) {
        console.error("Error fetching bins:", error);
      } else {
        setBins(data);
      }
    };

    fetchBins();
  }, []);

  // Initialize the map
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [103.6217, 1.5341],
        zoom: 15,
      });

      map.current.on("load", () => {
        setMapLoaded(true);
      });
    }
  }, []);

  // Add markers after map is loaded and bins are fetched
  useEffect(() => {
    if (mapLoaded && map.current && bins.length > 0) {
      bins.forEach((bin) => {
        new mapboxgl.Marker({ color: "#f97316" })
          .setLngLat([bin.longitude, bin.latitude])
          .setPopup(new mapboxgl.Popup().setText(bin.label))
          .addTo(map.current!);
      });
    }
  }, [mapLoaded, bins]);

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
