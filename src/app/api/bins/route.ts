// src/app/api/bins/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// --- REFINED INTERFACES ---

// Interface representing the EXACT raw schema of your 'bins' table in Supabase
interface SupabaseBinRow {
    bin_id: number;
    bin_plate: string;
    label: string;
    latitude: number;
    longitude: number;
    status_id: number;
    c_id: number | null;
    created_at: string;
    area: number; // ADDED: 'area' column from Supabase table
}

// Interface for the data that Supabase returns after the JOIN query
interface SupabaseBinDataWithCustomer extends SupabaseBinRow {
    customer: { c_name: string } | null;
    bin_status: { status: string } | null;
}

// Type for the data expected in the POST request body (frontend to backend)
interface BinCreateRequestBody {
    BinPlate: string;
    Location: string;
    Latitude: number;
    Longitude: number;
    StatusId?: number;
    CustomerId?: number | null;
    Area: number; // ADDED: Area for creation
}

// Type for the data expected in the PUT request body (frontend to backend)
interface BinUpdateRequestBody {
    BinID: number;
    BinPlate?: string;
    Location?: string;
    Latitude?: number;
    Longitude?: number;
    StatusId?: number;
    CustomerId?: number | null;
    Area?: number; // ADDED: Area for update
}

// Type for the data expected in the DELETE request body (frontend to backend)
interface BinDeleteRequestBody {
    BinID: number;
}

// Define the type for the data your API will return to the frontend.
interface BinWithCustomerAndStatusName {
    BinID: number;
    BinPlate: string;
    Location: string;
    Latitude: number;
    Longitude: number;
    StatusName: string; // This remains StatusName for frontend display
    CustomerID: number | null;
    CreatedAt: string;
    CustomerName: string | null;
    Area: number; // ADDED: Area for frontend display
}

// --- END REFINED INTERFACES ---


export async function GET() {
    try {
        const { data, error } = await supabase
            .from('bins')
            .select<string, SupabaseBinDataWithCustomer>(`
                *,
                customer:customer!bins_c_id_fkey(c_name),
                bin_status:bin_status!bins_status_id_fkey(status)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase GET error:', error);
            throw error;
        }

        if (!data) {
            return NextResponse.json({ error: 'No bin data found.' }, { status: 404 });
        }

        const binsWithCustomerAndStatusNames: BinWithCustomerAndStatusName[] = data.map(bin => ({
            BinID: bin.bin_id,
            BinPlate: bin.bin_plate,
            Location: bin.label,
            Latitude: bin.latitude,
            Longitude: bin.longitude,
            StatusName: bin.bin_status?.status || 'Unknown',
            CustomerID: bin.c_id,
            CreatedAt: bin.created_at,
            CustomerName: bin.customer?.c_name || null,
            Area: bin.area, // ADDED: Mapping 'area' from Supabase response
        }));

        return NextResponse.json(binsWithCustomerAndStatusNames);
    } catch (error: unknown) {
        console.error('GET /api/bins error:', error);
        if (error instanceof Error) {
            return NextResponse.json({ error: 'Failed to fetch bins', details: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Failed to fetch bins', details: 'An unknown error occurred.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { BinPlate, Location, Latitude, Longitude, StatusId, CustomerId, Area }: BinCreateRequestBody = await request.json(); // ADDED: Area

        if (!BinPlate || !Location || Latitude === undefined || Longitude === undefined || Area === undefined) { // ADDED: Area validation
            return NextResponse.json({ error: 'Missing required fields: BinPlate, Location, Latitude, Longitude, and Area are required.' }, { status: 400 });
        }

        let finalStatusId = StatusId;
        if (finalStatusId === undefined) {
            const { data: defaultStatus, error: statusError } = await supabase
                .from('bin_status')
                .select('status_id')
                .eq('status', 'Active')
                .single();

            if (statusError || !defaultStatus) {
                console.error('Could not find default "Active" status ID:', statusError);
                return NextResponse.json({ error: 'Failed to find default status for new bin.' }, { status: 500 });
            }
            finalStatusId = defaultStatus.status_id;
        }


        const { data, error } = await supabase
            .from('bins')
            .insert([
                {
                    bin_plate: BinPlate,
                    label: Location,
                    latitude: Latitude,
                    longitude: Longitude,
                    status_id: finalStatusId,
                    c_id: CustomerId || null,
                    area: Area, // ADDED: 'area' for insertion
                },
            ])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error: unknown) {
        console.error('POST /api/bins error:', error);
        if (error instanceof Error) {
            if ('code' in error && error.code === '23505') {
                return NextResponse.json({ error: 'Failed to create bin. Bin Plate might already exist (if unique).', details: error.message }, { status: 409 });
            }
            return NextResponse.json({ error: 'Failed to create bin', details: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Failed to create bin', details: 'An unknown error occurred.' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { BinID, BinPlate, Location, Latitude, Longitude, StatusId, CustomerId, Area }: BinUpdateRequestBody = await request.json(); // ADDED: Area

        if (!BinID) {
            return NextResponse.json({ error: 'BinID is required for updating.' }, { status: 400 });
        }

        const updateData: Partial<SupabaseBinRow> = {};
        if (BinPlate !== undefined) updateData.bin_plate = BinPlate;
        if (Location !== undefined) updateData.label = Location;
        if (Latitude !== undefined) updateData.latitude = Latitude;
        if (Longitude !== undefined) updateData.longitude = Longitude;
        if (StatusId !== undefined) updateData.status_id = StatusId;
        if (CustomerId !== undefined) updateData.c_id = CustomerId;
        if (Area !== undefined) updateData.area = Area; // ADDED: Area for update

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('bins')
            .update(updateData)
            .eq('bin_id', BinID)
            .select()
            .single();

        if (error) {
            throw error;
        }
        if (!data) {
            return NextResponse.json({ error: 'Bin not found or no changes made.' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('PUT /api/bins error:', error);
        if (error instanceof Error) {
            if ('code' in error && error.code === '23505') {
                return NextResponse.json({ error: 'Failed to update bin. Bin Plate might already exist for another bin (if unique).', details: error.message }, { status: 409 });
            }
            return NextResponse.json({ error: 'Failed to update bin', details: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Failed to update bin', details: 'An unknown error occurred.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { BinID }: BinDeleteRequestBody = await request.json();

        if (!BinID) {
            return NextResponse.json({ error: 'BinID is required for deletion.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('bins')
            .delete()
            .eq('bin_id', BinID)
            .select()
            .single();

        if (error) {
                if ('code' in error && error.code === '23503') {
                    return NextResponse.json({ error: 'Failed to delete bin. It might be referenced by other records (e.g., historical collections).', details: error.message }, { status: 409 });
                }
                throw error;
            }

        if (!data) {
                return NextResponse.json({ error: 'Bin not found.' }, { status: 404 });
            }

        return NextResponse.json({ message: 'Bin deleted successfully', deletedBin: data });
    } catch (error: unknown) {
        console.error('DELETE /api/bins error:', error);
        if (error instanceof Error) {
            return NextResponse.json({ error: 'Failed to delete bin', details: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Failed to delete bin', details: 'An unknown error occurred.' }, { status: 500 });
    }
}
