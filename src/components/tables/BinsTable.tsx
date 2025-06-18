'use client';

import Button from "../ui/button/Button";
import Input from "../form/input/InputField"; // Assuming InputField is suitable for text inputs
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog/Dialog";
import Label from "../form/Label"; // Corrected import path for Label
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { useRouter } from "next/navigation"; // Make sure useRouter is imported if not already

// Mapbox GL JS imports
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Set Mapbox access token directly for Canvas environment
// Ensure NEXT_PUBLIC_MAPBOX_TOKEN is correctly set in your .env.local file
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// --- INTERFACES ---

interface Bin {
    BinID: number;
    BinPlate: string;
    Location: string; // Corresponds to 'label' in Supabase
    Latitude: number;
    Longitude: number;
    StatusName: string;
    CustomerID: number | null;
    CreatedAt: string;
    CustomerName: string | null;
    Area: number; // Added Area to Bin interface
}

interface BinFormData {
    bin_plate: string;
    label: string; // Re-added for user input
    status_id: number | string;
    c_id: number | null;
}

interface Customer {
    c_id: number;
    c_name: string;
    // Assuming you'll fetch this from the API or manage it for display
    // If you need the address here for display in other parts, add it
    // address?: string;
}

// --- NEW INTERFACE FOR CUSTOMER FORM DATA ---
interface CustomerFormData {
    customer_name: string;
    customer_address: string;
}

const initialCustomerFormData: CustomerFormData = {
    customer_name: "",
    customer_address: "",
};
// --- END NEW INTERFACE ---

interface BinStatus {
    status_id: number;
    status: string;
}

// --- END INTERFACES ---


// Updated initialBinFormData: re-added label, removed latitude, longitude
const initialBinFormData: BinFormData = {
    bin_plate: "",
    label: "", // Re-added
    status_id: "",
    c_id: null,
};

// Helper function to format dates
function formatDateTime(isoString: string | null): string {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleString('en-MY', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return 'Invalid Date';
    }
}

export default function BinsTable() {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isShowDetailsModalOpen, setIsShowDetailsModalOpen] = useState(false); // State for details modal
    const [binDetailsToShow, setBinDetailsToShow] = useState<Bin | null>(null); // State to hold bin for details modal

    // --- NEW STATE FOR ADD CUSTOMER MODAL ---
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [customerFormData, setCustomerFormData] = useState<CustomerFormData>(initialCustomerFormData);
    // --- END NEW STATE ---

    // --- NEW STATE FOR SUCCESS MODAL ---
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    // --- END NEW STATE ---


    const [currentBin, setCurrentBin] = useState<Bin | null>(null);
    const [formData, setFormData] = useState<BinFormData>(initialBinFormData);
    const [binsData, setBinsData] = useState<Bin[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [binStatuses, setBinStatuses] = useState<BinStatus[]>([]);
    const [loading, setLoading] = useState(true); // Corrected this line
    const [error, setError] = useState<string | null>(null);

    // Map-related states for the modal
    const mapContainerRef = useRef<HTMLDivElement>(null); // Ref for the map container inside the dialog
    const mapInstanceRef = useRef<mapboxgl.Map | null>(null); // Ref for the Mapbox map instance
    const modalMarkerRef = useRef<mapboxgl.Marker | null>(null); // Ref for the single marker inside the modal's map
    const [formLocationCoords, setFormLocationCoords] = useState<{ lat: number; lng: number; area: number } | null>(null); // Coordinates for the form's map

    // Map center coordinates (Johor Bahru)
    const centerLat = 1.5341;
    const centerLng = 103.6217;

    // Area definitions and their names for display
    const areaNames = {
        1: "Northwest",
        2: "Northeast",
        3: "Southwest",
        4: "Southeast",
    };

    // Helper function to determine area based on coordinates (copied from BinMap)
    const getAreaFromCoords = useCallback((lat: number, lng: number): number => {
        if (lat > centerLat && lng < centerLng) return 1; // Northwest
        if (lat > centerLat && lng >= centerLng) return 2; // Northeast
        if (lat <= centerLat && lng < centerLng) return 3; // Southwest
        return 4; // Southeast
    }, [centerLat, centerLng]);


    // Function to fetch all necessary data (bins, customers, statuses)
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null); // Clear previous errors when re-fetching
        try {
            const [binsResponse, customersResponse, statusesResponse] = await Promise.all([
                fetch('/api/bins'),
                fetch('/api/customers'),
                fetch('/api/bin-statuses')
            ]);

            if (!binsResponse.ok) {
                throw new Error(`HTTP error! status: ${binsResponse.status} from /api/bins`);
            }
            if (!customersResponse.ok) {
                throw new Error(`HTTP error! status: ${customersResponse.status} from /api/customers`);
            }
            if (!statusesResponse.ok) {
                throw new Error(`HTTP error! status: ${statusesResponse.status} from /api/bin-statuses`);
            }

            const bins: Bin[] = await binsResponse.json();
            const customersData: Customer[] = await customersResponse.json();
            const statusesData: BinStatus[] = await statusesResponse.json();

            setBinsData(bins);
            setCustomers(customersData);
            setBinStatuses(statusesData);
        } catch (e) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial data fetch on component mount
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Map initialization and interaction inside the modal
    useEffect(() => {
        let animationFrameId: number;
        let mapInitTimeout: NodeJS.Timeout; // Specific timeout for map initialization

        const cleanupMap = () => {
            if (mapInstanceRef.current) {
                console.log("Cleaning up map instance.");
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
            if (modalMarkerRef.current) {
                modalMarkerRef.current.remove();
                modalMarkerRef.current = null;
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (mapInitTimeout) {
                clearTimeout(mapInitTimeout);
            }
        };

        const waitForContainerDimensions = (
            container: HTMLDivElement
        ): Promise<void> => {
            return new Promise((resolve) => {
                const checkDimensions = () => {
                    const width = container.offsetWidth;
                    const height = container.offsetHeight;
                    console.log(`Checking Map container dimensions: W: ${width}, H: ${height}`);
                    if (width > 0 && height > 0) {
                        resolve();
                    } else {
                        animationFrameId = requestAnimationFrame(checkDimensions);
                    }
                };
                checkDimensions();
            });
        };

        const initializeMap = async () => {
            if (!mapContainerRef.current) {
                console.warn("Map container ref is null at initializeMap call.");
                return;
            }

            // Ensure Mapbox token is set before attempting to initialize
            if (!mapboxgl.accessToken) {
                console.error("Mapbox Access Token is missing or invalid. Map will not load.");
                return;
            }

            // Wait for the container to have dimensions
            try {
                await waitForContainerDimensions(mapContainerRef.current);
            } catch (e) {
                console.error("Failed to get map container dimensions:", e);
                return;
            }

            // Ensure any old map instance is removed before creating a new one
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }

            const initialMapCenter: [number, number] = formLocationCoords ?
                [formLocationCoords.lng, formLocationCoords.lat] :
                [centerLng, centerLat];

            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: "mapbox://styles/mapbox/streets-v11",
                center: initialMapCenter,
                zoom: 15,
            });
            mapInstanceRef.current = map;

            // Immediately resize after creation
            map.resize();
            console.log("Map initialized and resized.");


            // Add marker if coordinates exist
            if (formLocationCoords) {
                const marker = new mapboxgl.Marker({ color: "#6F42C1", draggable: true, scale: 1.2 })
                    .setLngLat([formLocationCoords.lng, formLocationCoords.lat])
                    .addTo(map);
                modalMarkerRef.current = marker;

                // Add dragend listener for the marker
                marker.on('dragend', () => {
                    const newLngLat = marker.getLngLat();
                    const updatedArea = getAreaFromCoords(newLngLat.lat, newLngLat.lng);
                    setFormLocationCoords({
                        lat: newLngLat.lat,
                        lng: newLngLat.lng,
                        area: updatedArea,
                    });
                    console.log("Marker dragged, new formLocationCoords:", {lat: newLngLat.lat.toFixed(6), lng: newLngLat.lng.toFixed(6), area: updatedArea});
                });
            }

            // Add map click listener
            map.on('click', (e) => {
                const lngLat = e.lngLat;
                const detectedArea = getAreaFromCoords(lngLat.lat, lngLat.lng);

                setFormLocationCoords({ lat: lngLat.lat, lng: lngLat.lng, area: detectedArea });
                console.log("Map clicked, new formLocationCoords:", {lat: lngLat.lat.toFixed(6), lng: lngLat.lng.toFixed(6), area: detectedArea});

                // Update or create marker on click
                if (modalMarkerRef.current) {
                    modalMarkerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
                } else {
                    const marker = new mapboxgl.Marker({ color: "#6F42C1", draggable: true, scale: 1.2 })
                        .setLngLat([lngLat.lng, lngLat.lat])
                        .addTo(map);
                    modalMarkerRef.current = marker;

                    // Add dragend listener for new marker
                    marker.on('dragend', () => {
                        const newLngLat = marker.getLngLat();
                        const updatedArea = getAreaFromCoords(newLngLat.lat, newLngLat.lng);
                        setFormLocationCoords({
                            lat: newLngLat.lat,
                            lng: newLngLat.lng,
                            area: updatedArea,
                        });
                        console.log("Marker dragged (newly created), new formLocationCoords:", {lat: newLngLat.lat.toFixed(6), lng: newLngLat.lng.toFixed(6), area: updatedArea});
                    });
                }
                map.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 16, essential: true });
            });

            // Use 'idle' for a more reliable resize after map is fully loaded and drawn
            map.once('idle', () => {
                console.log("Map idle, performing final resize.");
                map.resize();
            });
        };

        // If a modal is open, attempt to initialize the map after a short delay
        // Only initialize map if it's the add/edit bin modal
        if (isAddModalOpen || isEditModalOpen) {
            console.log("Bin Add/Edit Modal opened. Scheduling map initialization...");
            mapInitTimeout = setTimeout(() => {
                initializeMap();
            }, 500); // Increased delay
        } else {
            // If modals are closed, ensure map is cleaned up
            cleanupMap();
        }

        // Cleanup function for useEffect (runs on unmount or before re-run)
        return cleanupMap;

    }, [isAddModalOpen, isEditModalOpen, formLocationCoords, getAreaFromCoords, centerLat, centerLng]);

    // --- CRUD Operations ---

    const handleCreateBin = async () => {
        // Validate required fields. Latitude, Longitude, and Area are now derived from map click
        if (!formData.bin_plate.trim() || !formData.label.trim() || !formData.status_id || !formData.c_id || !formLocationCoords) {
            // Replaced alert with error state
            setError("Please fill in all required fields (Bin Plate, Location Label, Status, Customer) and select a location on the map.");
            return;
        }

        try {
            const response = await fetch('/api/bins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    BinPlate: formData.bin_plate,
                    Location: formData.label, // User-provided location label
                    Latitude: formLocationCoords.lat, // Derived from map
                    Longitude: formLocationCoords.lng, // Derived from map
                    StatusId: Number(formData.status_id),
                    CustomerId: Number(formData.c_id),
                    Area: formLocationCoords.area, // Derived from map, saved to Area column
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            await fetchAllData(); // Re-fetch all data to update the table
            setIsAddModalOpen(false);
            setFormData(initialBinFormData); // Reset form
            setFormLocationCoords(null); // Clear map coords
            setError(null); // Clear any previous errors
            setSuccessMessage("Bin created successfully!"); // Set success message
            setIsSuccessModalOpen(true); // Open success modal
        } catch (e) {
            if (e instanceof Error) {
                setError(`Failed to create bin: ${e.message}`);
            } else {
                setError('An unknown error occurred while creating bin.');
            }
        }
    };

    const handleUpdateBin = async () => {
        if (!currentBin || !formLocationCoords) return;

        // Validate required fields. Latitude, Longitude, and Area are now derived from map click
        if (!formData.bin_plate.trim() || !formData.label.trim() || !formData.status_id || !formData.c_id) {
            alert("Please fill in all required fields (Bin Plate, Location Label, Status, Customer) and ensure a location is selected on the map.");
            return;
        }

        try {
            const response = await fetch('/api/bins', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    BinID: currentBin.BinID,
                    BinPlate: formData.bin_plate,
                    Location: formData.label, // User-provided location label
                    Latitude: formLocationCoords.lat, // Derived from map
                    Longitude: formLocationCoords.lng, // Derived from map
                    StatusId: Number(formData.status_id),
                    CustomerId: Number(formData.c_id),
                    Area: formLocationCoords.area, // Derived from map, saved to Area column
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            await fetchAllData(); // Re-fetch all data to get the latest bins with customer and status names
            setIsEditModalOpen(false);
            setCurrentBin(null);
            setFormData(initialBinFormData); // Reset form
            setFormLocationCoords(null); // Clear map coords
        } catch (e) {
            if (e instanceof Error) {
                setError(`Failed to update bin: ${e.message}`);
            } else {
                setError('An unknown error occurred while updating bin.');
            }
        }
    };

    const handleDeleteBin = async (binID: number) => {
        try {
            const response = await fetch('/api/bins', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ BinID: binID }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            await fetchAllData(); // Re-fetch to update the table after deletion
            setIsDeleteConfirmOpen(false);
            setCurrentBin(null);
            setError(null); // Clear any previous errors
            setSuccessMessage(`Bin ID ${binID} deleted successfully!`); // Set success message
            setIsSuccessModalOpen(true); // Open success modal
        } catch (e) {
            if (e instanceof Error) {
                setError(`Failed to delete bin: ${e.message}`);
            } else {
                setError('An unknown error occurred while deleting bin.');
            }
        }
    }

    // --- NEW: handleAddCustomer function ---
    const handleAddCustomer = async () => {
        // Validate required fields
        if (!customerFormData.customer_name.trim() || !customerFormData.customer_address.trim()) {
            setError("Please fill in both Customer Name and Address.");
            return;
        }

        try {
            const response = await fetch('/api/customers', { // Assuming your customer API route is /api/customers
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    CustomerName: customerFormData.customer_name,
                    CustomerAddress: customerFormData.customer_address,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            await fetchAllData(); // Re-fetch all data to update the customers dropdown
            setIsAddCustomerModalOpen(false);
            setCustomerFormData(initialCustomerFormData); // Reset form
            setError(null); // Clear previous errors on success
            setSuccessMessage(`Customer "${customerFormData.customer_name}" added successfully!`); // Set success message
            setIsSuccessModalOpen(true); // Open success modal
        } catch (e) {
            if (e instanceof Error) {
                setError(`Failed to add customer: ${e.message}`);
            } else {
                setError('An unknown error occurred while adding customer.');
            }
        }
    };
    // --- END NEW ---

    // --- Modal Open/Close Handlers ---

    const openEditModal = (bin: Bin) => {
        // Reset formData and formLocationCoords before setting new values
        // This is a common pattern to ensure child components re-render with fresh props.
        setFormData(initialBinFormData); 
        setFormLocationCoords(null);

        setCurrentBin(bin);
        // Set initial form data including current bin's location and area
        setFormLocationCoords({
            lat: bin.Latitude,
            lng: bin.Longitude,
            area: bin.Area, // Populate area from existing bin data
        });

        const initialEditFormData = {
            bin_plate: bin.BinPlate,
            label: bin.Location, // Populate label from existing bin data
            status_id: binStatuses.find(s => s.status === bin.StatusName)?.status_id.toString() || "",
            c_id: bin.CustomerID
        };
        setFormData(initialEditFormData);
        console.log("openEditModal: formData after setFormData:", initialEditFormData); // NEW LOG
        setIsEditModalOpen(true);
    };

    const openAddModal = () => {
        setCurrentBin(null);
        setFormData(initialBinFormData);
        setFormLocationCoords(null);
        setIsAddModalOpen(true);
        setError(null); // Clear error when opening modal
    };

    // --- NEW: openAddCustomerModal handler ---
    const openAddCustomerModal = () => {
        setCustomerFormData(initialCustomerFormData); // Reset form for new customer
        setIsAddCustomerModalOpen(true);
        setError(null); // Clear error when opening modal
    };
    // --- END NEW ---

    const router = useRouter();

    const handleNavigateToMap = () => {
        router.push("/map");
    };

    const openDeleteConfirm = (bin: Bin) => {
        setCurrentBin(bin);
        setIsDeleteConfirmOpen(true);
        setError(null); // Clear error when opening modal
    };

    const openBinDetailsModal = (bin: Bin) => {
        setBinDetailsToShow(bin);
        setIsShowDetailsModalOpen(true);
    };

    // --- Form Input Change Handlers ---

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    // --- NEW: handleCustomerInputChange for customer modal ---
    const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCustomerFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };
    // --- END NEW ---

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'c_id' ? (value === "" ? null : Number(value)) : value,
        }));
    };

    // --- Render Functions ---

    const renderBinForm = (
        submitHandler: () => void,
        closeHandler: () => void,
        title: string,
        description: string,
        submitButtonText: string
    ) => (
        <>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                {/* Map display for location selection */}
                <div className="mb-4">
                    <Label className="block text-gray-700 text-sm font-bold mb-2">
                        Click on the map or drag the marker to set/change bin location:
                    </Label>
                    <div 
                        className="w-full h-64 rounded-md overflow-hidden border border-gray-300" 
                        ref={mapContainerRef} 
                        // Added explicit min-width/min-height for debugging
                        style={{ minWidth: '400px', minHeight: '300px' }} // Even more aggressive sizing for debugging
                    />
                    {!mapboxgl.accessToken ? (
                        <p className="text-red-500 text-xs mt-1">Mapbox Access Token is missing or invalid. Please check your environment configuration.</p>
                    ) : null}
                    {formLocationCoords && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                            Selected Location: Lat: {formLocationCoords.lat.toFixed(4)}, Lng: {formLocationCoords.lng.toFixed(4)}<br />
                            Area: <strong>{areaNames[formLocationCoords.area as keyof typeof areaNames]} ({formLocationCoords.area})</strong>
                        </div>
                    )}
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bin_plate" className="text-right">Bin Plate</Label>
                    {/* Using a standard HTML input directly for troubleshooting */}
                    <input
                        id="bin_plate"
                        name="bin_plate"
                        type="text" // Ensure type is text
                        value={formData.bin_plate}
                        onChange={handleInputChange}
                        className="col-span-3 border border-gray-300 rounded-md p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                {/* Location Label input field */}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="label" className="text-right">Location Label</Label>
                    {/* Using a standard HTML input directly for troubleshooting */}
                    <input 
                        id="label" 
                        name="label" 
                        type="text" // Ensure type is text
                        value={formData.label} 
                        onChange={handleInputChange} 
                        className="col-span-3 border border-gray-300 rounded-md p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                {/* Latitude and Longitude input fields remain removed as they are now map-derived and displayed in info box */}
                
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status_id" className="text-right">Status</Label>
                    <select
                        id="status_id"
                        name="status_id"
                        value={formData.status_id}
                        onChange={handleSelectChange}
                        className="col-span-3 border border-gray-300 rounded-md p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Select Status</option>
                        {binStatuses.map((status) => (
                            <option key={status.status_id} value={status.status_id}>
                                {status.status}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="c_id" className="text-right">Customer</Label>
                    <select
                        id="c_id"
                        name="c_id"
                        value={formData.c_id === null ? "" : formData.c_id}
                        onChange={handleSelectChange}
                        className="col-span-3 border border-gray-300 rounded-md p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Select Customer (Optional)</option>
                        {customers.map((customer) => (
                            <option key={customer.c_id} value={customer.c_id}>
                                {customer.c_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeHandler}>Cancel</Button>
                <Button onClick={submitHandler}>{submitButtonText}</Button>
            </DialogFooter>
        </>
    );

    // --- NEW: renderCustomerForm function ---
    const renderCustomerForm = (submitHandler: () => void, closeHandler: () => void) => (
        <>
            <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                    Enter the name and address for the new customer.
                </DialogDescription>
            </DialogHeader>
            {/* Error message for customer form */}
            {error && isAddCustomerModalOpen && <div className="mb-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}

            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="customer_name" className="text-right">
                        Customer Name
                    </Label>
                    <Input
                        id="customer_name"
                        name="customer_name"
                        value={customerFormData.customer_name}
                        onChange={handleCustomerInputChange}
                        className="col-span-3"
                        required
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="customer_address" className="text-right">
                        Address
                    </Label>
                    <Input
                        id="customer_address"
                        name="customer_address"
                        value={customerFormData.customer_address}
                        onChange={handleCustomerInputChange}
                        className="col-span-3"
                        required
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeHandler}>Cancel</Button>
                <Button onClick={submitHandler}>Add Customer</Button>
            </DialogFooter>
        </>
    );
    // --- END NEW ---


    if (loading) {
        return <div className="p-4 text-center">Loading bin data...</div>;
    }

    // Consolidated error display logic: show general error if no specific modal is open
    if (error && !isAddModalOpen && !isEditModalOpen && !isDeleteConfirmOpen && !isAddCustomerModalOpen && !isSuccessModalOpen) {
        return <div className="p-4 text-center text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex justify-end space-x-3"> {/* Use space-x-3 for consistent spacing */}
                <button
                    onClick={handleNavigateToMap}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                    Map View
                </button>

                {/* --- NEW: Add Customer Button and Dialog --- */}
                <Dialog open={isAddCustomerModalOpen} onOpenChange={(isOpen) => {
                    setIsAddCustomerModalOpen(isOpen);
                    if (!isOpen) {
                        setCustomerFormData(initialCustomerFormData); // Reset form on close
                        setError(null); // Clear errors on close
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button
                            onClick={openAddCustomerModal}
                            className="px-4 py-2 bg-yellow-700 text-white rounded-md hover:bg-yellow-800" // Brown color
                        >
                            Add Customer
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        {renderCustomerForm(handleAddCustomer, () => {
                            setIsAddCustomerModalOpen(false);
                            setCustomerFormData(initialCustomerFormData);
                            setError(null);
                        })}
                    </DialogContent>
                </Dialog>
                {/* --- END NEW --- */}

                <Button onClick={openAddModal}>Add Bin</Button> {/* Add Bin button */}
            </div>

            {/* Edit Bin Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[500px]" key={isEditModalOpen ? "edit-modal-open" : "edit-modal-closed"}>
                    {currentBin && renderBinForm(
                        handleUpdateBin,
                        () => setIsEditModalOpen(false),
                        "Edit Bin",
                        "Update the details and location of the bin.",
                        "Save Changes"
                    )}
                </DialogContent>
            </Dialog>

            {/* Add Bin Dialog */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[500px]" key={isAddModalOpen ? "add-modal-open" : "add-modal-closed"}>
                    {renderBinForm(
                        handleCreateBin,
                        () => setIsAddModalOpen(false),
                        "Add New Bin",
                        "Fill in the details and select a location for the new bin.",
                        "Create Bin"
                    )}
                </DialogContent>
            </Dialog>

            {/* Bin Details Dialog */}
            <Dialog open={isShowDetailsModalOpen} onOpenChange={setIsShowDetailsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Bin Details</DialogTitle>
                        <DialogDescription>
                            Detailed information for the selected bin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {binDetailsToShow ? (
                            <>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Bin ID:</Label>
                                    <span>{binDetailsToShow.BinID}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Bin Plate:</Label>
                                    <span>{binDetailsToShow.BinPlate}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Location Label:</Label>
                                    <span>{binDetailsToShow.Location}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Latitude:</Label>
                                    <span>{binDetailsToShow.Latitude}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Longitude:</Label>
                                    <span>{binDetailsToShow.Longitude}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Status:</Label>
                                    <span>
                                        <Badge
                                            size="sm"
                                            color={binDetailsToShow.StatusName === "Active" ? "success" : "error"}
                                        >
                                            {binDetailsToShow.StatusName}
                                        </Badge>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Customer:</Label>
                                    <span>{binDetailsToShow.CustomerName || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Area:</Label>
                                    <span>{areaNames[binDetailsToShow.Area as keyof typeof areaNames] || `Area ${binDetailsToShow.Area}`}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Created At:</Label>
                                    <span>{formatDateTime(binDetailsToShow.CreatedAt)}</span>
                                </div>
                            </>
                        ) : (
                            <p>No bin details available.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsShowDetailsModalOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog 
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete bin &quot;{currentBin?.Location}&quot; (ID: {currentBin?.BinID}, Plate: {currentBin?.BinPlate})? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {error && isDeleteConfirmOpen && <div className="my-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={() => { if (currentBin) handleDeleteBin(currentBin.BinID); setIsDeleteConfirmOpen(false); }}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>*/}

            {/* Success Confirmation Dialog */}
            <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-green-600">Success!</DialogTitle>
                        <DialogDescription>
                            {successMessage}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setIsSuccessModalOpen(false)}>Okay</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {binsData.length === 0 && !loading && !error && (
                <div className="p-4 text-center">No bin data available. Consider creating one.</div>
            )}

            {binsData.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto">
                        <div className="min-w-[1102px]">
                            <Table>
                                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                    <TableRow>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            #
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Bin Plate
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Location
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Latitude
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Longitude
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Area
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Status
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Customer Name
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Created At
                                        </TableCell>
                                        <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                                            Actions
                                        </TableCell> {/* Consolidated Actions Header */}
                                    </TableRow>
                                </TableHeader>

                                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                    {binsData.map((bin, index) => (
                                        <TableRow key={bin.BinID}>
                                            <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">
                                                {bin.BinPlate}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {bin.Location}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {bin.Latitude}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {bin.Longitude}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {areaNames[bin.Area as keyof typeof areaNames] || `Area ${bin.Area}`}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                <Badge
                                                    size="sm"
                                                    color={bin.StatusName === "Active" ? "success" : "error"}
                                                >
                                                    {bin.StatusName}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {bin.CustomerName || 'N/A'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                                                {formatDateTime(bin.CreatedAt)}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {/* Consolidated Actions buttons with specific colors */}
                                                <Button variant="outline" size="sm" className="mr-2" onClick={() => openBinDetailsModal(bin)}>
                                                    Details
                                                </Button>
                                                <Button className="bg-green-600 text-white hover:bg-green-700 mr-2" size="sm" onClick={() => openEditModal(bin)}>
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {binsData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="px-5 py-4 text-center text-gray-500 dark:text-gray-400">
                                                No bins found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
