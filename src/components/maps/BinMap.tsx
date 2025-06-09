"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Define the type for a Bin object, matching your database schema
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

// Define the type for bin status, matching your database schema
type bin_status = { status_id: number; status: string };

// Define the type for customer, matching your database schema
type customer = { c_id: number; c_name: string };

// Main BinMap React component
export default function BinMap() {
  // Ref for the map container DOM element
  const mapContainer = useRef<HTMLDivElement>(null);
  // Ref for the Mapbox GL JS map instance
  const map = useRef<mapboxgl.Map | null>(null);

  // State to store bin data fetched from Supabase
  const [bins, setBins] = useState<Bin[]>([]);
  // State to store bin status data
  const [statuses, setStatuses] = useState<bin_status[]>([]);
  // State to store customer data (not used for map markers, but kept for completeness if needed elsewhere)
  const [customers, setCustomers] = useState<customer[]>([]);
  // State to track if the map has loaded
  const [mapLoaded, setMapLoaded] = useState(false);
  // State to keep track of current Mapbox markers on the map
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);

  // State for displaying temporary messages (e.g., success/error)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  // State for showing the delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // State to store the bin object that is pending deletion
  const [binToDelete, setBinToDelete] = useState<Bin | null>(null);

  // State to track if the component has mounted on the client-side (for hydration)
  const [mounted, setMounted] = useState(false);

  // Default center coordinates for the map (Johor Bahru, Malaysia)
  const centerLat = 1.5341;
  const centerLng = 103.6217;

  // Area definitions and their names for display
  const areaNames: { [key: number]: string } = {
    1: "Northwest",
    2: "Northeast",
    3: "Southwest",
    4: "Southeast",
  };

  // State for filtering bins by area
  const [areaFilter, setAreaFilter] = useState<number | null>(null);

  /**
   * Determines the area ID based on latitude and longitude relative to the center point.
   * @param lat - Latitude of the bin.
   * @param lng - Longitude of the bin.
   * @returns The area ID (1-4).
   */
  const getAreaFromCoords = (lat: number, lng: number): number => {
    if (lat > centerLat && lng < centerLng) return 1; // Northwest
    if (lat > centerLat && lng >= centerLng) return 2; // Northeast
    if (lat <= centerLat && lng < centerLng) return 3; // Southwest
    return 4; // Southeast
  };

  /**
   * Returns a color code for a bin marker based on its area.
   * @param lat - Latitude of the bin.
   * @param lng - Longitude of the bin.
   * @returns A Tailwind CSS compatible hex color string.
   */
  const getBinColor = (lat: number, lng: number) => {
    if (lat > centerLat && lng < centerLng) return "#f43f5e"; // Red - NW (Area 1)
    if (lat > centerLat && lng >= centerLng) return "#3b82f6"; // Blue - NE (Area 2)
    if (lat <= centerLat && lng < centerLng) return "#10b981"; // Green - SW (Area 3)
    return "#eab308"; // Yellow - SE (Area 4)
  };

  /**
   * Displays a temporary message on the UI.
   * @param text - The message text.
   * @param type - The type of message ('success', 'error', 'info').
   */
  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    // Hide the message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  /**
   * Fetches all bin data from the 'bins' table in Supabase.
   */
  const fetchBins = async () => {
    if (typeof supabase === 'undefined') {
      console.error("Supabase client is not initialized or available globally.");
      showMessage("Supabase client is not available. Please ensure it's initialized.", "error");
      return;
    }
    const { data, error } = await supabase.from("bins").select("*");
    if (error) {
      console.error("❌ Error fetching bins:", error);
      showMessage("Failed to load bin data.", "error");
    } else {
      setBins(data);
    }
  };

  /**
   * Fetches data from related tables ('bin_status' and 'customer').
   */
  const fetchRelatedTables = async () => {
    if (typeof supabase === 'undefined') return; // Only fetch if supabase is available

    const { data: statusData, error: statusError } = await supabase.from("bin_status").select("*");
    if (statusError) console.error("Error fetching bin_status:", statusError);

    const { data: customerData, error: customerError } = await supabase.from("customer").select("*");
    if (customerError) console.error("Error fetching customer:", customerError);

    setStatuses(statusData || []);
    setCustomers(customerData || []);
  };

  // Effect hook to set mounted state to true after initial client-side render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Effect hook to initialize Supabase data fetching and real-time subscription
  useEffect(() => {
    if (!mounted || typeof supabase === 'undefined') {
        console.warn("Supabase client not available for real-time subscription or component not yet mounted.");
        return;
    }
    // Establish a real-time channel for 'bins' table changes
    const channel = supabase
      .channel('bins_changes') // Unique channel name
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bins' }, payload => {
        // When a change occurs (insert, update, delete), re-fetch all bins to update the map
        console.log('Real-time change received for bins:', payload);
        fetchBins();
      })
      .subscribe(); // Subscribe to the channel

    // Initial data fetch when component mounts
    fetchBins();
    fetchRelatedTables();

    // Cleanup function: Unsubscribe from the channel when the component unmounts
    return () => {
      if (typeof supabase !== 'undefined') { // Check if supabase is available before removing channel
        supabase.removeChannel(channel);
      }
    };
  }, [mounted]); // Depend on 'mounted' to ensure it runs client-side

  // Effect hook to initialize the Mapbox map
  useEffect(() => {
    // Only proceed if component is mounted and mapboxgl is loaded globally
    if (!mounted || typeof mapboxgl === 'undefined') {
      if (!mounted) {
        console.warn("Mapbox GL JS initialization deferred until component is mounted.");
      } else {
        console.error("Mapbox GL JS is not loaded. Please ensure it's included via a <script> tag in your HTML.");
        showMessage("Mapbox GL JS is not loaded.", "error");
      }
      return;
    }

    // Only initialize map if it hasn't been initialized yet and the container is available
    if (!map.current && mapContainer.current) {
      // Set Mapbox access token here, ensuring it runs client-side.
      // It's crucial that Mapbox GL JS is loaded *before* this script.
      if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
          mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      } else {
          console.warn("Mapbox Access Token not found in environment variables. Mapbox might not load correctly without it.");
          // You might need to hardcode it here for testing if not using Next.js env:
          // mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current!, // Map container element
        style: "mapbox://styles/mapbox/streets-v11", // Map style
        center: [centerLng, centerLat], // Initial map center
        zoom: 15, // Initial zoom level
      });

      // Set mapLoaded to true once the map has finished loading
      map.current.on("load", () => setMapLoaded(true));
    }
  }, [mounted]); // Depend on 'mounted' to ensure it runs client-side

  // Effect hook to update markers on the map whenever bins, mapLoaded, statuses, or areaFilter changes
  useEffect(() => {
    // Ensure map is loaded before attempting to add markers
    if (!mapLoaded || !map.current || typeof mapboxgl === 'undefined') return;

    // Clear all existing markers from the map before adding new ones
    markers.forEach((marker) => marker.remove());
    const newMarkers: mapboxgl.Marker[] = []; // Array to store newly created markers

    // Filter bins based on the selected area filter
    const filteredBins = areaFilter ? bins.filter(bin => bin.area === areaFilter) : bins;

    // Iterate over filtered bins and create a marker for each
    filteredBins.forEach((bin) => {
      // Get the color for the bin marker based on its geographical area
      const color = getBinColor(bin.latitude, bin.longitude);
      // Determine the status string and whether the bin is 'Active'
      const status = statuses.find((s) => s.status_id == bin.status_id)?.status || "Unknown";
      const isActive = status.toLowerCase() === "active";
      // Set status text color based on active status
      const statusColor = isActive ? "#10b981" : "#ef4444";
      // Get the human-readable area name
      const areaName = areaNames[bin.area as keyof typeof areaNames] || `Area ${bin.area}`;

      // Create HTML content for the marker's popup
      const popupContent = `
        <div class="font-sans text-sm">
          <strong>${bin.label}</strong><br/>
          Status: <span style="color: ${statusColor}; font-weight: bold;">${status}</span><br/>
          Bin Plate: ${bin.bin_plate}<br/>
          Area: <span style="font-weight: bold;">${areaName} (${bin.area})</span>
        </div>
      `;

      // Create a new Mapbox marker
      const marker = new mapboxgl.Marker({
        color: color, // Marker color based on area
        scale: 1, // Default scale (1x)
      })
        .setLngLat([bin.longitude, bin.latitude]) // Set marker's longitude and latitude
        .setPopup(new mapboxgl.Popup().setHTML(popupContent)) // Attach a popup with bin details
        .addTo(map.current!); // Add marker to the map

      // Add a right-click (contextmenu) listener to each bin marker for deletion
      marker.getElement().addEventListener("contextmenu", async (e) => {
        e.preventDefault(); // Prevent default browser context menu
        setBinToDelete(bin); // Set the bin to be deleted
        setShowDeleteConfirm(true); // Show the confirmation modal
      });

      newMarkers.push(marker); // Add the marker to the list of new markers
    });

    // Add a distinct marker for the Bin Collection Center
    const centerMarker = new mapboxgl.Marker({
      color: "#6F42C1", // Unique color for center marker
      scale: 1.5, // Make center marker slightly larger
    })
      .setLngLat([centerLng, centerLat]) // Set its coordinates
      .setPopup(new mapboxgl.Popup().setText("Bin Collection Center")) // Popup text
      .addTo(map.current!); // Add to map

    newMarkers.push(centerMarker); // Add center marker to the list
    setMarkers(newMarkers); // Update the state with all new markers
  }, [bins, mapLoaded, statuses, areaFilter]); // Re-run effect if these dependencies change

  /**
   * Handles the deletion of a bin after user confirmation.
   */
  const handleDeleteBin = async () => {
    if (!binToDelete || typeof supabase === 'undefined') return; // If no bin is selected for deletion, or supabase not available

    const { error } = await supabase.from("bins").delete().eq("bin_id", binToDelete.bin_id);

    if (error) {
      console.error("❌ Error deleting bin:", error);
      showMessage("Failed to delete bin: " + error.message, "error");
    } else {
      showMessage(`🗑️ Bin "${binToDelete.label}" deleted.`, "success");
      // The real-time listener will automatically trigger fetchBins() to update the map
    }
    // Close the confirmation modal and clear the binToDelete state
    setShowDeleteConfirm(false);
    setBinToDelete(null);
  };

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-300 font-sans">
      {/* Temporary message display */}
      {message && (
        <div className={`absolute z-20 top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-white shadow-lg text-sm text-center
            ${message.type === 'success' ? 'bg-green-500' : ''}
            ${message.type === 'error' ? 'bg-red-500' : ''}
            ${message.type === 'info' ? 'bg-blue-500' : ''}`
        }>
          {message.text}
        </div>
      )}

      {/* Controls Row - Only contains Area Filter */}
      <div className="absolute z-10 top-4 left-4 flex gap-2">
        {/* Area Filter Dropdown */}
        <select
          value={areaFilter || ""}
          onChange={(e) => setAreaFilter(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
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
            Showing {bins.filter(bin => bin.area === areaFilter).length} bins in {areaNames[areaFilter]}
          </span>
        ) : (
          <span>Showing {bins.length} bins (All Areas)</span>
        )}
      </div>

      {/* Area Legend */}
      <div className="absolute z-10 top-4 right-4 bg-white shadow-lg p-3 rounded-lg border">
        <h3 className="text-sm font-bold mb-2">Area Colors</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#f43f5e" }}></div>
            <span className={areaFilter === 1 ? 'font-bold text-blue-600' : ''}>Area 1 - Northwest</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#3b82f6" }}></div>
            <span className={areaFilter === 2 ? 'font-bold text-blue-600' : ''}>Area 2 - Northeast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#10b981" }}></div>
            <span className={areaFilter === 3 ? 'font-bold text-blue-600' : ''}>Area 3 - Southwest</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#eab308" }}></div>
            <span className={areaFilter === 4 ? 'font-bold text-blue-600' : ''}>Area 4 - Southeast</span>
          </div>
          <hr className="my-2 border-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#6F42C1" }}></div>
            <span>Collection Center</span>
          </div>
        </div>
      </div>

      {/* Map Container - Conditionally rendered after component mounts on client */}
      {mounted && <div ref={mapContainer} className="w-full h-full" />}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && binToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full border border-gray-200">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Confirm Deletion</h3>
            <p className="text-gray-700">Are you sure you want to delete bin "<span className="font-semibold">{binToDelete.label}</span>"? This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setBinToDelete(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBin}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
          </div>
      )}
    </div>
  );
}
