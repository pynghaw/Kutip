'use client';

import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
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

// Define a type for the form data, excluding id for creation
interface TruckFormData {
  plate_no: string;
  driver_name: string;
  capacity_kg: number | string; // Allow string for input field, convert to number on submit
  is_active: boolean;
}

interface Truck extends TruckFormData {
  id: number; // Changed from TruckID to id
  created_at: string; // Changed from CreatedAt to created_at
}

// Initial form state for creating a new truck
const initialTruckFormData: TruckFormData = {
  plate_no: "",
  driver_name: "",
  capacity_kg: "", // Initialize as string for the input field
  is_active: true,
};

export default function TrucksTable() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentTruck, setCurrentTruck] = useState<Truck | null>(null); // For editing or deleting
  const [formData, setFormData] = useState<TruckFormData>(initialTruckFormData);
  const [trucksData, setTrucksData] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/trucks');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTrucksData(data);
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

    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateTruck = async () => {
    try {
      const response = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send snake_case keys to the API
          PlateNo: formData.plate_no, 
          DriverName: formData.driver_name,
          CapacityKg: parseFloat(formData.capacity_kg as string),
          IsActive: formData.is_active,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      const newTruck = await response.json();
      setTrucksData([...trucksData, newTruck]);
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
          TruckID: currentTruck.id, // Use id here
          // Send snake_case keys to the API for properties being updated
          PlateNo: formData.plate_no,
          DriverName: formData.driver_name,
          CapacityKg: parseFloat(formData.capacity_kg as string),
          IsActive: formData.is_active,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      const updatedTruck = await response.json();
      setTrucksData(trucksData.map(t => t.id === updatedTruck.id ? updatedTruck : t)); // Compare with id
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
      setTrucksData(trucksData.filter(t => t.id !== truckId)); // Filter by id
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
      driver_name: truck.driver_name,
      capacity_kg: truck.capacity_kg.toString(),
      is_active: truck.is_active,
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
          <Label htmlFor="driver_name" className="text-right">
            Driver Name
          </Label>
          <Input id="driver_name" name="driver_name" defaultValue={formData.driver_name} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="capacity_kg" className="text-right">
            Capacity (Kg)
          </Label>
          <Input id="capacity_kg" name="capacity_kg" type="number" defaultValue={formData.capacity_kg} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="is_active" className="text-right">
            Active
          </Label>
          <Input id="is_active" name="is_active" type="checkbox" checked={formData.is_active} onChange={handleInputChange} className="col-span-3 h-4 w-4" />
        </div>
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

  // Display error message prominently if it exists, affecting the whole component
  if (error && !isCreateModalOpen && !isEditModalOpen && !isDeleteConfirmOpen) {
     // Only show general page error if no modal is open (modals can have their own error context if needed)
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
            {error && (isCreateModalOpen || isEditModalOpen) && <div className="mb-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
            {renderTruckForm(handleCreateTruck, () => {setIsCreateModalOpen(false); setError(null); setFormData(initialTruckFormData);}, false)}
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
          {error && (isCreateModalOpen || isEditModalOpen) && <div className="mb-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
          {currentTruck && renderTruckForm(handleUpdateTruck, () => {setIsEditModalOpen(false); setError(null); setCurrentTruck(null);}, true)}
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
              Are you sure you want to delete truck &quot;{currentTruck?.plate_no}&quot; (ID: {currentTruck?.id})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && isDeleteConfirmOpen && <div className="my-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => {setIsDeleteConfirmOpen(false); setError(null); setCurrentTruck(null);}}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (currentTruck) handleDeleteTruck(currentTruck.id); else { setIsDeleteConfirmOpen(false); setError(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {trucksData.length === 0 && !loading && !error && (
        <div className="p-4 text-center">No truck data available. Consider creating one.</div>
      )}

      {trucksData.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1102px]"> {/* Adjusted min-width if necessary based on columns */}
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">#</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Truck ID</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Plate No</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Driver Name</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Capacity (Kg)</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Created At</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {trucksData.map((truck, index) => (
                    <TableRow key={truck.id}> 
                      <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">{index + 1}</TableCell>
                      <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">{truck.id}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.plate_no}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.driver_name}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.capacity_kg}</TableCell>
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
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}