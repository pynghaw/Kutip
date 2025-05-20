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

// Define a type for the form data, excluding BinID for creation
interface BinFormData {
  Location: string;
  Latitude: number | string; // Allow string for input field, convert to number on submit
  Longitude: number | string; // Allow string for input field, convert to number on submit
  IsActive: boolean;
}

interface Bin extends BinFormData {
  BinID: number;
  CreatedAt: string; // Assuming CreatedAt is a string, adjust if it's a Date object
}

// Initial form state for creating a new bin
const initialBinFormData: BinFormData = {
  Location: "",
  Latitude: "",
  Longitude: "",
  IsActive: true,
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
          ...formData,
          Latitude: parseFloat(formData.Latitude as string),
          Longitude: parseFloat(formData.Longitude as string),
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
          BinID: currentBin.BinID,
          ...formData,
          Latitude: parseFloat(formData.Latitude as string),
          Longitude: parseFloat(formData.Longitude as string),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      const updatedBin = await response.json();
      setBinsData(binsData.map(b => b.BinID === updatedBin.BinID ? updatedBin : b));
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
        body: JSON.stringify({ BinID: binId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      setBinsData(binsData.filter(b => b.BinID !== binId));
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
      Location: bin.Location,
      Latitude: bin.Latitude.toString(),
      Longitude: bin.Longitude.toString(),
      IsActive: bin.IsActive,
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
      {/* ModalBody is not available in Dialog, content is placed directly or within DialogContent */}
      <div className="grid gap-4 py-4"> {/* This div was previously inside ModalBody */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="Location" className="text-right">
            Location
          </Label>
          <Input id="Location" name="Location" defaultValue={formData.Location} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="Latitude" className="text-right">
            Latitude
          </Label>
          <Input id="Latitude" name="Latitude" defaultValue={formData.Latitude} onChange={handleInputChange} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="Longitude" className="text-right">
            Longitude
          </Label>
          <Input id="Longitude" name="Longitude" defaultValue={formData.Longitude} onChange={handleInputChange} className="col-span-3" />
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
              Are you sure you want to delete bin &quot;{currentBin?.Location}&quot; (ID: {currentBin?.BinID})? This action cannot be undone. 
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (currentBin) handleDeleteBin(currentBin.BinID); setIsDeleteConfirmOpen(false); }}>Delete</Button>
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
                  <TableRow key={bin.BinID}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">
                      {index + 1}
                    </TableCell>
                    <TableCell className="px-5 py-4 sm:px-6 text-start text-gray-800 dark:text-white/90">
                      {bin.BinID}
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
                      <Badge
                        size="sm"
                        color={bin.IsActive ? "success" : "error"}
                      >
                        {bin.IsActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {new Date(bin.CreatedAt).toLocaleDateString()} {/* Format date as needed */}
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
