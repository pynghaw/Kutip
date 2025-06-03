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

// --- START: CORRECTED INTERFACES ---

// Interface for the data returned directly from your /api/bins GET endpoint
interface Bin {
  BinID: number;
  BinPlate: string;
  Location: string;
  Latitude: number;
  Longitude: number;
  StatusName: string;        // This remains StatusName for display convenience
  CustomerID: number | null;
  CreatedAt: string;
  CustomerName: string | null;
}

// Interface for the form data (used for Update Bin modal)
interface BinFormData {
  bin_plate: string;
  label: string;
  latitude: number | string;
  longitude: number | string;
  status_id: number | string;
  c_id: number | null;
}

// Interface for Customer data (remains the same)
interface Customer {
  c_id: number;
  c_name: string;
}

// NEW Interface for Bin Status data
interface BinStatus {
  status_id: number;
  status: string; // CHANGED: Column name is 'status'
}

// --- END: CORRECTED INTERFACES ---


const initialBinFormData: BinFormData = {
  bin_plate: "",
  label: "",
  latitude: "",
  longitude: "",
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentBin, setCurrentBin] = useState<Bin | null>(null);
  const [formData, setFormData] = useState<BinFormData>(initialBinFormData);
  const [binsData, setBinsData] = useState<Bin[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [binStatuses, setBinStatuses] = useState<BinStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
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
    }

    fetchData();
  }, []);

  const handleUpdateBin = async () => {
    if (!currentBin) return;
    try {
      const response = await fetch('/api/bins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BinID: currentBin.BinID,
          BinPlate: formData.bin_plate,
          Location: formData.label,
          Latitude: parseFloat(formData.latitude as string),
          Longitude: parseFloat(formData.longitude as string),
          StatusId: formData.status_id === "" ? undefined : Number(formData.status_id),
          CustomerId: formData.c_id
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      // Re-fetch all data to get the latest bins with customer and status names
      const fetchResponse = await fetch('/api/bins');
      const updatedBins = await fetchResponse.json();
      setBinsData(updatedBins);

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
      setBinsData(binsData.filter(b => b.BinID !== binID));
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
    // Find the status ID based on the status name for the form
    const currentStatus = binStatuses.find(s => s.status === bin.StatusName); // CHANGED: Compare with 'status'
    setFormData({
      bin_plate: bin.BinPlate,
      label: bin.Location,
      latitude: bin.Latitude.toString(),
      longitude: bin.Longitude.toString(),
      status_id: currentStatus ? currentStatus.status_id : "",
      c_id: bin.CustomerID
    });
    setIsEditModalOpen(true);
  };

  const openDeleteConfirm = (bin: Bin) => {
    setCurrentBin(bin);
    setIsDeleteConfirmOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'c_id' ? (value === "" ? null : Number(value)) : value,
    }));
  };

  if (loading) {
    return <div className="p-4 text-center">Loading bin data...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error loading data: {error}</div>;
  }

  const renderBinForm = (submitHandler: () => void, closeHandler: () => void) => (
    <>
      <DialogHeader>
        <DialogTitle>Edit Bin</DialogTitle>
        <DialogDescription>
          Update the details of the bin.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="bin_plate" className="text-right">Bin Plate</Label>
          <Input
            id="bin_plate"
            name="bin_plate"
            defaultValue={formData.bin_plate}
            onChange={handleInputChange}
            className="col-span-3"
          />
        </div>
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
                {status.status} {/* CHANGED: Use status.status */}
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
        <Button onClick={submitHandler}>Save Changes</Button>
      </DialogFooter>
    </>
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-end">
        {/* Removed Create Bin button */}
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {currentBin && renderBinForm(handleUpdateBin, () => setIsEditModalOpen(false))}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete bin &quot;{currentBin?.Location}&quot; (ID: {currentBin?.BinID}, Plate: {currentBin?.BinPlate})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { if (currentBin) handleDeleteBin(currentBin.BinID); setIsDeleteConfirmOpen(false); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  </TableCell>
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
                      <Button variant="outline" size="sm" className="mr-2" onClick={() => openEditModal(bin)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openDeleteConfirm(bin)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {binsData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="px-5 py-4 text-center text-gray-500 dark:text-gray-400">
                      No bins found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}