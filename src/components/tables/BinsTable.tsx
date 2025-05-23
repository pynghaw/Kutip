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
// import Image from "next/image"; // Image might not be needed for Bin data unless Location is an image path

// Define a type for the form data, excluding id for creation
interface BinFormData {
  label: string; // Changed from Location to label
  latitude: number | string;
  longitude: number | string;
  is_active: boolean;
}

interface Bin extends BinFormData {
  id: number; // Changed from BinID to id
  created_at: string; // Changed from CreatedAt to created_at
}

// Initial form state for creating a new bin
const initialBinFormData: BinFormData = {
  label: "",
  latitude: "",
  longitude: "",
  is_active: true,
};



export default function BinsTable() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentBin, setCurrentBin] = useState<Bin | null>(null); // For editing or deleting
  const [formData, setFormData] = useState<BinFormData>(initialBinFormData);
  const [binsData, setBinsData] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/bins');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setBinsData(data);
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

  if (loading) {
    return <div className="p-4 text-center">Loading bin data...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error loading data: {error}</div>;
  }

  // CRUD Handlers (to be implemented)
  const handleCreateBin = async () => {
    try {
      const response = await fetch('/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send snake_case keys to the API
          Location: formData.label, // API expects Location, maps to label in DB
          Latitude: parseFloat(formData.latitude as string),
          Longitude: parseFloat(formData.longitude as string),
          IsActive: formData.is_active,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      const newBin = await response.json();
      setBinsData([...binsData, newBin]);
      setIsCreateModalOpen(false);
      setFormData(initialBinFormData); // Reset form
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to create bin: ${e.message}`);
      } else {
        setError('An unknown error occurred while creating bin.');
      }
    }
  };

  const handleUpdateBin = async () => {
    if (!currentBin) return;
    try {
      const response = await fetch('/api/bins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BinID: currentBin.id, // Use id here
          // Send snake_case keys to the API for properties being updated
          Location: formData.label, // API expects Location
          Latitude: parseFloat(formData.latitude as string),
          Longitude: parseFloat(formData.longitude as string),
          IsActive: formData.is_active,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      const updatedBin = await response.json();
      setBinsData(binsData.map(b => b.id === updatedBin.id ? updatedBin : b)); // Compare with id
      setIsEditModalOpen(false);
      setCurrentBin(null);
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to update bin: ${e.message}`);
      } else {
        setError('An unknown error occurred while updating bin.');
      }
    }
  };

  const handleDeleteBin = async (binId: number) => {
    try {
      const response = await fetch('/api/bins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ BinID: binId }), // API expects BinID, ensure this matches API
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      setBinsData(binsData.filter(b => b.id !== binId)); // Filter by id
      setIsDeleteConfirmOpen(false);
      setCurrentBin(null);
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to delete bin: ${e.message}`);
      } else {
        setError('An unknown error occurred while deleting bin.');
      }
    }
  };

  const openEditModal = (bin: Bin) => {
    setCurrentBin(bin);
    setFormData({
      label: bin.label,
      latitude: bin.latitude.toString(),
      longitude: bin.longitude.toString(),
      is_active: bin.is_active,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteConfirm = (bin: Bin) => {
    setCurrentBin(bin);
    setIsDeleteConfirmOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  if (!binsData || binsData.length === 0) {
    return <div className="p-4 text-center">No bin data available.</div>;
  }

  const renderBinForm = (submitHandler: () => void, closeHandler: () => void, isEditMode: boolean) => (
    <>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Bin' : 'Create New Bin'}</DialogTitle>
        <DialogDescription>
          {isEditMode ? 'Update the details of the bin.' : 'Enter the details for the new bin.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="label" className="text-right">Location</Label>
          <Input id="label" name="label" defaultValue={formData.label} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="latitude" className="text-right">Latitude</Label>
          <Input id="latitude" name="latitude" defaultValue={formData.latitude} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="longitude" className="text-right">Longitude</Label>
          <Input id="longitude" name="longitude" defaultValue={formData.longitude} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="is_active" className="text-right">Active</Label>
          <Input id="is_active" name="is_active" type="checkbox" checked={formData.is_active} onChange={handleInputChange} className="col-span-3 h-4 w-4" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={closeHandler}>Cancel</Button>
        <Button onClick={submitHandler}>{isEditMode ? 'Save Changes' : 'Create Bin'}</Button>
      </DialogFooter>
    </>
  );
  

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-end">
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setFormData(initialBinFormData); setIsCreateModalOpen(true); }}>Create New Bin</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            {renderBinForm(handleCreateBin, () => setIsCreateModalOpen(false), false)}
          </DialogContent>
        </Dialog>
      </div>
      {/* Edit Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {currentBin && renderBinForm(handleUpdateBin, () => setIsEditModalOpen(false), true)}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete bin &quot;{currentBin?.label}&quot; (ID: {currentBin?.id})? This action cannot be undone.
            </DialogDescription>

          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (currentBin) handleDeleteBin(currentBin.id); setIsDeleteConfirmOpen(false); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1102px]">
            <Table>
              {/* Table Header */}
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    #
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Bin ID
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Location
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Latitude
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Longitude
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Status
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Created At
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {binsData.map((bin, index) => (
                  <TableRow key={bin.id}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">
                      {index + 1}
                    </TableCell>
                    <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">
                      {bin.id}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      {bin.label}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      {bin.latitude}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      {bin.longitude}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      <Badge
                        size="sm"
                        color={bin.is_active ? "success" : "error"}
                      >
                        {bin.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {new Date(bin.created_at).toLocaleDateString()} {/* Format date as needed */}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      <Button variant="outline" size="sm" className="mr-2" onClick={() => openEditModal(bin)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openDeleteConfirm(bin)}>
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
    </div>
  );
}
