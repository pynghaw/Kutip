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
};

type bin_status = { status_id: number; status: string };
type customer = { c_id: number; c_name: string };

export default function BinMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [statuses, setStatuses] = useState<bin_status[]>([]);
  const [customers, setCustomers] = useState<customer[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isAddingBin, setIsAddingBin] = useState(false);
  const [newCoords, setNewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    status_id: "",
    customer_id: "",
    bin_plate: "",
  });

  const centerLat = 1.5341;
  const centerLng = 103.6217;

  const getBinColor = (lat: number, lng: number) => {
    if (lat > centerLat && lng < centerLng) return "#f43f5e"; // Red - NW
    if (lat > centerLat && lng >= centerLng) return "#3b82f6"; // Blue - NE
    if (lat <= centerLat && lng < centerLng) return "#10b981"; // Green - SW
    return "#eab308"; // Yellow - SE
  };

  const fetchBins = async () => {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) {
      console.error("❌ Error fetching bins:", error);
    } else {
      setBins(data);
    }
  };

  const fetchRelatedTables = async () => {
    const { data: statusData } = await supabase.from("bin_status").select("*");
    const { data: customerData } = await supabase.from("customer").select("*");
    setStatuses(statusData || []);
    setCustomers(customerData || []);
  };

  useEffect(() => {
    fetchBins();
    fetchRelatedTables();
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

    bins.forEach((bin) => {
      const color = getBinColor(bin.latitude, bin.longitude);
      const status = statuses.find((s) => s.status_id == bin.status)?.status || "Unknown";
       const statusColor = status.toLowerCase() == "active" ? "#10b981" : "#ef4444";

  const popupContent = `
    <div>
      <strong>${bin.label}</strong><br/>
      Status:<span style="color: ${statusColor}; font-weight: bold;"> ${status}</span><br/>
      Bin Plate: ${bin.bin_plate}
    </div>
  `;

  const marker = new mapboxgl.Marker({ color })
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

      newMarkers.push(marker);
    });

    // Add center marker
    const centerMarker = new mapboxgl.Marker({
      color: 	"#6F42C1",
      scale: 1.5,
    })
      .setLngLat([centerLng, centerLat])
      .setPopup(new mapboxgl.Popup().setText("Bin Collection Center"))
      .addTo(map.current!);

    newMarkers.push(centerMarker);

    setMarkers(newMarkers);
  }, [bins, mapLoaded]);

  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (!isAddingBin) return;
      const lngLat = e.lngLat;
      setNewCoords({ lat: lngLat.lat, lng: lngLat.lng });
      setShowForm(true);
      setIsAddingBin(false);
    };

    map.current.on("click", handleMapClick);
    return () => {
      map.current?.off("click", handleMapClick);
    };
  }, [isAddingBin]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoords) return;

    const { error } = await supabase.from("bins").insert({
      label: formData.label,
      status: Number(formData.status_id),
      c_id: Number(formData.customer_id),
      bin_plate: formData.bin_plate,
      latitude: newCoords.lat,
      longitude: newCoords.lng,
    });

    if (error) {
      alert("❌ Failed to save bin");
      console.error(error);
    } else {
      setShowForm(false);
      setFormData({ label: "", status_id: "", customer_id: "", bin_plate: "" });
      setNewCoords(null);
      await fetchBins();
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-300">
      <button
        onClick={() => {
          setIsAddingBin(true);
          alert("Click on the map to select bin location.");
        }}
        className="absolute z-10 top-4 left-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
      >
        + Add Bin
      </button>

      <div ref={mapContainer} className="w-full h-full" />

      {showForm && (
        <div className="absolute z-50 top-16 left-4 bg-white shadow-xl p-4 rounded-lg border w-80">
          <h2 className="text-lg font-bold mb-2">Add Bin</h2>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <input
              name="label"
              value={formData.label}
              onChange={handleInputChange}
              placeholder="Bin Label"
              required
              className="w-full border p-2 rounded"
            />
            <input
              name="bin_plate"
              value={formData.bin_plate}
              onChange={handleInputChange}
              placeholder="Bin Plate"
              required
              className="w-full border p-2 rounded"
            />
            <select
              name="status_id"
              value={formData.status_id}
              onChange={handleInputChange}
              required
              className="w-full border p-2 rounded"
            >
              <option value="">Select Status</option>
              {statuses.map((s) => (
                <option key={s.status_id} value={s.status_id}>{s.status}</option>
              ))}
            </select>
            <select
              name="customer_id"
              value={formData.customer_id}
              onChange={handleInputChange}
              required
              className="w-full border p-2 rounded"
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.c_id} value={c.c_id}>{c.c_name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 bg-gray-300 rounded">
                Cancel
              </button>
              <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">
                Save Bin
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
