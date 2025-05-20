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

// Define a type for the form data, excluding TruckID for creation
interface TruckFormData {
  PlateNo: string;
  DriverName: string;
  CapacityKg: number | string; // Allow string for input field, convert to number on submit
  IsActive: boolean;
}

interface Truck extends TruckFormData {
  TruckID: number;
  CreatedAt: string; // Assuming CreatedAt is a string, adjust if it's a Date object
}

// Initial form state for creating a new truck
const initialTruckFormData: TruckFormData = {
  PlateNo: "",
  DriverName: "",
  CapacityKg: "", // Initialize as string for the input field
  IsActive: true,
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
          ...formData,
          CapacityKg: parseFloat(formData.CapacityKg as string), // Ensure CapacityKg is a number
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
      const response = await fetch('/api/trucks', { // Assuming PUT updates via the same base endpoint
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TruckID: currentTruck.TruckID,
          ...formData,
          CapacityKg: parseFloat(formData.CapacityKg as string), // Ensure CapacityKg is a number
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      const updatedTruck = await response.json();
      setTrucksData(trucksData.map(t => t.TruckID === updatedTruck.TruckID ? updatedTruck : t));
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
      const response = await fetch('/api/trucks', { // Assuming DELETE uses the same base endpoint
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TruckID: truckId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      setTrucksData(trucksData.filter(t => t.TruckID !== truckId));
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
      PlateNo: truck.PlateNo,
      DriverName: truck.DriverName,
      CapacityKg: truck.CapacityKg.toString(), // Convert number to string for input field
      IsActive: truck.IsActive,
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
          <Label htmlFor="PlateNo" className="text-right">
            Plate No
          </Label>
          <Input id="PlateNo" name="PlateNo" defaultValue={formData.PlateNo} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="DriverName" className="text-right">
            Driver Name
          </Label>
          <Input id="DriverName" name="DriverName" defaultValue={formData.DriverName} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="CapacityKg" className="text-right">
            Capacity (Kg)
          </Label>
          <Input id="CapacityKg" name="CapacityKg" type="number" defaultValue={formData.CapacityKg} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="IsActive" className="text-right">
            Active
          </Label>
          <Input id="IsActive" name="IsActive" type="checkbox" checked={formData.IsActive} onChange={handleInputChange} className="col-span-3 h-4 w-4" />
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
              Are you sure you want to delete truck &quot;{currentTruck?.PlateNo}&quot; (ID: {currentTruck?.TruckID})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && isDeleteConfirmOpen && <div className="my-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => {setIsDeleteConfirmOpen(false); setError(null); setCurrentTruck(null);}}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (currentTruck) handleDeleteTruck(currentTruck.TruckID); else { setIsDeleteConfirmOpen(false); setError(null); } }}>Delete</Button>
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
                    <TableRow key={truck.TruckID}>
                      <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">{index + 1}</TableCell>
                      <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">{truck.TruckID}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.PlateNo}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.DriverName}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{truck.CapacityKg}</TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                        <Badge size="sm" color={truck.IsActive ? "success" : "error"}>
                          {truck.IsActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                        {new Date(truck.CreatedAt).toLocaleDateString()}
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