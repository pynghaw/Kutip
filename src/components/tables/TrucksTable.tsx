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
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

// Define a type for the form data, INCLUDING is_active
interface TruckFormData {
    plate_no: string;
    d_id: number | string;
    is_active: boolean; // Added is_active to form data
}

interface Truck {
    truck_id: number;
    plate_no: string;
    d_id: number;
    DriverName: string | null;
    is_active: boolean;
    created_at: string;
}

const initialTruckFormData: TruckFormData = {
    plate_no: "",
    d_id: "",
    is_active: true, // Default to active for new trucks
};

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

export default function TrucksTable() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isShowDetailsModalOpen, setIsShowDetailsModalOpen] = useState(false); // State for details modal
    const [truckDetailsToShow, setTruckDetailsToShow] = useState<Truck | null>(null);

    const [currentTruck, setCurrentTruck] = useState<Truck | null>(null);
    const [formData, setFormData] = useState<TruckFormData>(initialTruckFormData);
    const [trucksData, setTrucksData] = useState<Truck[]>([]);
    const [drivers, setDrivers] = useState<{ user_id: number, first_name: string | null, last_name: string | null, username: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDataAndDrivers = useCallback(async () => {
        setLoading(true);
        setError(null); // Clear error when fetching data
        try {
            const trucksResponse = await fetch('/api/trucks');
            if (!trucksResponse.ok) {
                throw new Error(`HTTP error fetching trucks! status: ${trucksResponse.status}`);
            }
            const trucksData: Truck[] = await trucksResponse.json();
            setTrucksData(trucksData);

            const usersResponse = await fetch('/api/users');
            if (!usersResponse.ok) {
                throw new Error(`HTTP error fetching users! status: ${usersResponse.status}`);
            }
            const usersData = await usersResponse.json();
            const driverUsers = usersData.filter((u: any) => u.role === 'driver' && u.is_active);
            setDrivers(driverUsers);

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

    useEffect(() => {
        fetchDataAndDrivers();
    }, [fetchDataAndDrivers]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleCreateTruck = async () => {
        try {
            const response = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    PlateNo: formData.plate_no,
                    DriverID: parseInt(formData.d_id as string),
                    IsActive: formData.is_active, // Include is_active for creation
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            await fetchDataAndDrivers();
            setIsCreateModalOpen(false);
            setFormData(initialTruckFormData);
            setError(null);
            setSuccessMessage("Truck created successfully!"); // Set success message
            setIsSuccessModalOpen(true); // Open success modal
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
                    TruckID: currentTruck.truck_id,
                    PlateNo: formData.plate_no,
                    DriverID: parseInt(formData.d_id as string),
                    IsActive: formData.is_active, // Include is_active for update
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            await fetchDataAndDrivers();
            setIsEditModalOpen(false);
            setCurrentTruck(null);
            setError(null);
            setSuccessMessage("Truck updated successfully!"); // Set success message
            setIsSuccessModalOpen(true); // Open success modal
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
                body: JSON.stringify({ TruckID: truckId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
            }
            // Instead of filtering, re-fetch to ensure data consistency
            await fetchDataAndDrivers();
            setIsDeleteConfirmOpen(false);
            setCurrentTruck(null);
            setError(null);
            setSuccessMessage(`Truck ID ${truckId} deleted successfully!`); // Set success message
            setIsSuccessModalOpen(true); // Open success modal
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
            d_id: truck.d_id.toString(),
            is_active: truck.is_active, // Populate is_active
        });
        setIsEditModalOpen(true);
        setError(null);
    };

    const openDeleteConfirm = (truck: Truck) => {
        setCurrentTruck(truck);
        setIsDeleteConfirmOpen(true);
        setError(null);
    };

    const openTruckDetailsModal = (truck: Truck) => {
        setTruckDetailsToShow(truck);
        setIsShowDetailsModalOpen(true);
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
                    <select
                        id="d_id"
                        name="d_id"
                        value={formData.d_id}
                        onChange={handleSelectChange}
                        className="col-span-3 border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                    >
                        <option value="" disabled>Select a driver</option>
                        {drivers.map((driver) => (
                            <option key={driver.user_id} value={driver.user_id}>
                                {driver.first_name && driver.last_name ? `${driver.first_name} ${driver.last_name}` : driver.username}
                            </option>
                        ))}
                    </select>
                </div>
                {isEditMode && ( // Only show status in edit mode
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="is_active" className="text-right">
                            Status
                        </Label>
                        <input
                            type="checkbox"
                            id="is_active"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleInputChange}
                            className="col-span-3 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="col-span-3 text-sm text-gray-500 dark:text-gray-400">
                            {formData.is_active ? "Active" : "Inactive"}
                        </span>
                    </div>
                )}
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

    if (error && !isCreateModalOpen && !isEditModalOpen && !isDeleteConfirmOpen && !isSuccessModalOpen) {
        return <div className="p-4 text-center text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex justify-end space-x-2"> {/* Added space-x-2 for button spacing */}
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
                    setCurrentTruck(null);
                    setError(null);
                }
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    {/* Show error inside modal if it's open */}
                    {error && (isCreateModalOpen || isEditModalOpen) && <div className="mb-4 text-red-500 bg-red-100 p-3 rounded-md">{error}</div>}
                    {currentTruck && renderTruckForm(handleUpdateTruck, () => { setIsEditModalOpen(false); setError(null); setCurrentTruck(null); }, true)}
                </DialogContent>
            </Dialog>

            {/* Truck Details Dialog */}
            <Dialog open={isShowDetailsModalOpen} onOpenChange={setIsShowDetailsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Truck Details</DialogTitle>
                        <DialogDescription>
                            Detailed information for the selected truck.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {truckDetailsToShow ? (
                            <>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Truck ID:</Label>
                                    <span>{truckDetailsToShow.truck_id}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Plate No:</Label>
                                    <span>{truckDetailsToShow.plate_no}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Driver Name:</Label>
                                    <span>{truckDetailsToShow.DriverName || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Status:</Label>
                                    <span>
                                        <Badge
                                            size="sm"
                                            color={truckDetailsToShow.is_active ? "success" : "error"}
                                        >
                                            {truckDetailsToShow.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 items-center gap-4">
                                    <Label className="text-right">Created At:</Label>
                                    <span>{formatDateTime(truckDetailsToShow.created_at)}</span>
                                </div>
                            </>
                        ) : (
                            <p>No truck details available.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsShowDetailsModalOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            {/* Re-enabled for completeness, as it was commented out in the original.
                Make sure to adjust the handleDeleteTruck to use `currentTruck` for ID if desired,
                or pass the ID directly from the `openDeleteConfirm` function.
                For now, it's left as is to match the current flow of passing truck object.
            */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => {
                setIsDeleteConfirmOpen(isOpen);
                if (!isOpen) {
                    setCurrentTruck(null);
                    setError(null);
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
                                                {(() => {
                                                    const driver = drivers.find(d => d.user_id === truck.d_id);
                                                    return driver ? (driver.first_name && driver.last_name ? `${driver.first_name} ${driver.last_name}` : driver.username) : 'N/A';
                                                })()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                <Badge size="sm" color={truck.is_active ? "success" : "error"}>
                                                    {truck.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {formatDateTime(truck.created_at)}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                <Button variant="outline" size="sm" className="mr-2" onClick={() => openTruckDetailsModal(truck)}>
                                                    Details
                                                </Button>
                                                <Button className="bg-green-600 text-white hover:bg-green-700 mr-2" size="sm" onClick={() => openEditModal(truck)}>
                                                    Edit
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