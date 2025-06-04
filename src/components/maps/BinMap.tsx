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
  status_id: number;
  c_id: number;
  bin_plate: string;
  area: number;
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
  const [newCoords, setNewCoords] = useState<{ lat: number; lng: number; area: number } | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    status_id: "",
    customer_id: "",
    bin_plate: "",
  });
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

  const getAreaFromCoords = (lat: number, lng: number): number => {
    if (lat > centerLat && lng < centerLng) return 1; // Northwest
    if (lat > centerLat && lng >= centerLng) return 2; // Northeast
    if (lat <= centerLat && lng < centerLng) return 3; // Southwest
    return 4; // Southeast
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

    // Filter bins based on area filter
    const filteredBins = areaFilter ? bins.filter(bin => bin.area === areaFilter) : bins;

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
  }, [bins, mapLoaded, statuses, areaFilter]);

  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (!isAddingBin) return;
      const lngLat = e.lngLat;
      const detectedArea = getAreaFromCoords(lngLat.lat, lngLat.lng);
      
      setNewCoords({ lat: lngLat.lat, lng: lngLat.lng, area: detectedArea });
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

    // Validate form data
    if (!formData.label.trim()) {
      alert("Please enter a bin label");
      return;
    }
    if (!formData.bin_plate.trim()) {
      alert("Please enter a bin plate");
      return;
    }

    const { error } = await supabase.from("bins").insert({
      label: formData.label.trim(),
      status: Number(formData.status_id),
      c_id: Number(formData.customer_id),
      bin_plate: formData.bin_plate.trim(),
      latitude: newCoords.lat,
      longitude: newCoords.lng,
      area: newCoords.area,
    });

    if (error) {
      alert("❌ Failed to save bin: " + error.message);
      console.error(error);
    } else {
      alert(`✅ Bin "${formData.label}" added successfully in ${areaNames[newCoords.area as keyof typeof areaNames]}!`);
      setShowForm(false);
      setFormData({ label: "", status_id: "", customer_id: "", bin_plate: "" });
      setNewCoords(null);
      await fetchBins();
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-300">
      {/* Controls Row */}
      <div className="absolute z-10 top-4 left-4 flex gap-2">
        <button
          onClick={() => {
            setIsAddingBin(true);
            alert("📍 Click anywhere on the map to place a new bin. The area will be automatically determined based on location.");
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
        >
          + Add Bin
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

      {showForm && newCoords && (
        <div className="absolute z-50 top-24 left-4 bg-white shadow-xl p-4 rounded-lg border w-80">
          <h2 className="text-lg font-bold mb-2">Add Bin</h2>
          
          {/* Area Info */}
          <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
            <strong>Area:</strong> {areaNames[newCoords.area as keyof typeof areaNames]}
          </div>
          
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