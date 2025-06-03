'use client';

import Button from "../ui/button/Button";
import Input from "../form/input/InputField"; // Input might still be used for PlateNo
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog/Dialog";
import Label from "../form/Label";
import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";

// --- NEW INTERFACE FOR DRIVER DATA ---
interface Driver {
  d_id: number;
  d_name: string;
}
// --- END NEW INTERFACE ---


// Define a type for the form data, EXCLUDING is_active
interface TruckFormData {
  plate_no: string;
  d_id: number | string; // Changed from driver_name to d_id, allow string for input (empty state)
  // is_active is removed from form data
}

interface Truck {
  truck_id: number; // Primary key is now truck_id
  plate_no: string;
  d_id: number; // The foreign key to the drivers table
  DriverName: string | null; // The flattened driver name from the API join
  is_active: boolean; // KEEP this here if you still display it in the table
  created_at: string;
}

// Initial form state for creating a new truck
const initialTruckFormData: TruckFormData = {
  plate_no: "",
  d_id: "", // Initialize as empty string for the select input
  // is_active is removed from initial state
};

export default function TrucksTable() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentTruck, setCurrentTruck] = useState<Truck | null>(null); // For editing or deleting
  const [formData, setFormData] = useState<TruckFormData>(initialTruckFormData);
  const [trucksData, setTrucksData] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]); // --- NEW STATE FOR DRIVERS ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDataAndDrivers() {
      try {
        // --- FETCH TRUCKS DATA ---
        const trucksResponse = await fetch('/api/trucks');
        if (!trucksResponse.ok) {
          throw new Error(`HTTP error fetching trucks! status: ${trucksResponse.status}`);
        }
        const trucksData: Truck[] = await trucksResponse.json();
        setTrucksData(trucksData);

        // --- FETCH DRIVERS DATA ---
        const driversResponse = await fetch('/api/drivers'); // Call the new drivers API
        if (!driversResponse.ok) {
          throw new Error(`HTTP error fetching drivers! status: ${driversResponse.status}`);
        }
        const driversData: Driver[] = await driversResponse.json();
        setDrivers(driversData);

      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDataAndDrivers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; // Removed type and checked as is_active is gone
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // --- NEW: Handle Change for Select (Dropdown) ---
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value, // Value will be the d_id (string)
    }));
  };
  // --- END NEW ---

  const handleCreateTruck = async () => {
    try {
      const response = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          PlateNo: formData.plate_no,
          DriverID: parseInt(formData.d_id as string), // Ensure it's parsed to a number
          // IsActive is removed from here
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      // Re-fetch all trucks to get the updated list including the new truck's driver name
      const fetchResponse = await fetch('/api/trucks');
      const updatedTrucks = await fetchResponse.json();
      setTrucksData(updatedTrucks);

      setIsCreateModalOpen(false);
      setFormData(initialTruckFormData); // Reset form
      setError(null); // Clear previous errors
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to create truck: ${e.message}`);
      } else {
        setError('An unknown error occurred while creating truck.');
      }
    }
  };

  const handleUpdateTruck = async () => {
    if (!currentTruck) return;
    try {
      const response = await fetch('/api/trucks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TruckID: currentTruck.truck_id, // Use truck_id here
          PlateNo: formData.plate_no,
          DriverID: parseInt(formData.d_id as string), // Ensure it's parsed to a number
          // IsActive is removed from here
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      // Re-fetch all trucks to get updated list including updated driver name
      const fetchResponse = await fetch('/api/trucks');
      const updatedTrucks = await fetchResponse.json();
      setTrucksData(updatedTrucks);

      setIsEditModalOpen(false);
      setCurrentTruck(null);
      setError(null); // Clear previous errors
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to update truck: ${e.message}`);
      } else {
        setError('An unknown error occurred while updating truck.');
      }
    }
  };

  const handleDeleteTruck = async (truckId: number) => {
    try {
      const response = await fetch('/api/trucks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TruckID: truckId }), // API expects TruckID, ensure this matches API
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      setTrucksData(trucksData.filter(t => t.truck_id !== truckId)); // Filter by truck_id
      setIsDeleteConfirmOpen(false);
      setCurrentTruck(null);
      setError(null); // Clear previous errors
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to delete truck: ${e.message}`);
      } else {
        setError('An unknown error occurred while deleting truck.');
      }
    }
  };

  const openEditModal = (truck: Truck) => {
    setCurrentTruck(truck);
    setFormData({
      plate_no: truck.plate_no,
      d_id: truck.d_id.toString(), // Convert d_id to string for the select's value
      // is_active is removed from here
    });
    setIsEditModalOpen(true);
    setError(null); // Clear previous errors when opening modal
  };

  const openDeleteConfirm = (truck: Truck) => {
    setCurrentTruck(truck);
    setIsDeleteConfirmOpen(true);
    setError(null); // Clear previous errors
  };

  const renderTruckForm = (submitHandler: () => void, closeHandler: () => void, isEditMode: boolean) => (
    <>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Truck' : 'Create New Truck'}</DialogTitle>
        <DialogDescription>
          {isEditMode ? 'Update the details of the truck.' : 'Enter the details for the new truck.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="plate_no" className="text-right">
            Plate No
          </Label>
          <Input id="plate_no" name="plate_no" defaultValue={formData.plate_no} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="d_id" className="text-right">
            Driver Name
          </Label>
          {/* --- MODIFIED: Replaced Input with Select for Driver ID --- */}
          <select
            id="d_id"
            name="d_id"
            value={formData.d_id} // Controlled component: value from state
            onChange={handleSelectChange} // Use the new handleSelectChange
            className="col-span-3 border rounded p-2"
            required // Make selection mandatory
          >
            <option value="" disabled>Select a driver</option> {/* Placeholder/default option */}
            {drivers.map((driver) => (
              <option key={driver.d_id} value={driver.d_id}>
                {driver.d_name}
              </option>
            ))}
          </select>
          {/* --- END MODIFIED --- */}
        </div>
        {/* --- REMOVED: IsActive Checkbox --- */}
        {/*
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="is_active" className="text-right">
            Active
          </Label>
          <Input id="is_active" name="is_active" type="checkbox" checked={formData.is_active} onChange={handleInputChange} className="col-span-3 h-4 w-4" />
        </div>
        */}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={closeHandler}>Cancel</Button>
        <Button onClick={submitHandler}>{isEditMode ? 'Save Changes' : 'Create Truck'}</Button>
      </DialogFooter>
    </>
  );

  if (loading) {
    return <div className="p-4 text-center">Loading truck data...</div>;
  }

  if (error && !isCreateModalOpen && !isEditModalOpen && !isDeleteConfirmOpen) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-end">
        <Dialog open={isCreateModalOpen} onOpenChange={(isOpen) => {
          setIsCreateModalOpen(isOpen);
          if (!isOpen) {
            setFormData(initialTruckFormData); // Reset form when closing
            setError(null); // Clear errors when closing
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setFormData(initialTruckFormData); setError(null); setIsCreateModalOpen(true); }}>Create New Truck</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            {/* Show error inside modal if it's open */}
            {error && (isCreateModalOpen || isEditModalOpen) && <div className="mb-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
            {renderTruckForm(handleCreateTruck, () => { setIsCreateModalOpen(false); setError(null); setFormData(initialTruckFormData); }, false)}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={(isOpen) => {
        setIsEditModalOpen(isOpen);
        if (!isOpen) {
          setCurrentTruck(null); // Clear current truck when closing
          setError(null); // Clear errors
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          {/* Show error inside modal if it's open */}
          {error && (isCreateModalOpen || isEditModalOpen) && <div className="mb-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
          {currentTruck && renderTruckForm(handleUpdateTruck, () => { setIsEditModalOpen(false); setError(null); setCurrentTruck(null); }, true)}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => {
        setIsDeleteConfirmOpen(isOpen);
        if (!isOpen) {
          setCurrentTruck(null); // Clear current truck when closing
          setError(null); // Clear errors
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete truck &quot;{currentTruck?.plate_no}&quot; (ID: {currentTruck?.truck_id})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && isDeleteConfirmOpen && <div className="my-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDeleteConfirmOpen(false); setError(null); setCurrentTruck(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (currentTruck) handleDeleteTruck(currentTruck.truck_id); else { setIsDeleteConfirmOpen(false); setError(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {trucksData.length === 0 && !loading && !error && (
        <div className="p-4 text-center">No truck data available. Consider creating one.</div>
      )}

      {trucksData.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">#</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Plate No</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Driver Name</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Created At</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {trucksData.map((truck, index) => (
                    <TableRow key={truck.truck_id}>
                      <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">{index + 1}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.plate_no}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                        {truck.DriverName || 'N/A'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                        <Badge size="sm" color={truck.is_active ? "success" : "error"}>
                          {truck.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                        {new Date(truck.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                        <Button variant="outline" size="sm" className="mr-2" onClick={() => openEditModal(truck)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => openDeleteConfirm(truck)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {trucksData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="px-5 py-4 text-center text-gray-500 dark:text-gray-400">
                        No trucks found.
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