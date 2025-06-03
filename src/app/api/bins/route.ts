// src/app/api/bins/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// --- REFINED INTERFACES ---

// Interface representing the EXACT raw schema of your 'bins' table in Supabase
interface SupabaseBinRow {
  bin_id: number;           // Primary Key - remains number
  bin_plate: string;        // NEW COLUMN - string
  label: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  c_id: number | null;
  created_at: string;
}

// Interface for the data that Supabase returns after the JOIN query
interface SupabaseBinDataWithCustomer extends SupabaseBinRow {
  customer: { c_name: string } | null;
}

// Type for the data expected in the POST request body (frontend to backend)
interface BinCreateRequestBody {
  BinPlate: string;           // Now you need to send this for the new column
  Location: string;
  Latitude: number;
  Longitude: number;
  IsActive?: boolean;
  CustomerId?: number | null;
}

// Type for the data expected in the PUT request body (frontend to backend)
interface BinUpdateRequestBody {
  BinID: number;             // Remains number, as it's the primary key for updates
  BinPlate?: string;         // Optional, if you want to update the bin_plate itself
  Location?: string;
  Latitude?: number;
  Longitude?: number;
  IsActive?: boolean;
  CustomerId?: number | null;
}

// Type for the data expected in the DELETE request body (frontend to backend)
interface BinDeleteRequestBody {
  BinID: number;             // Remains number, as it's the primary key for deletion
}

// Define the type for the data your API will return to the frontend.
interface BinWithCustomerName {
  BinID: number;             // Still present in the frontend response
  BinPlate: string;          // Added for frontend display
  Location: string;
  Latitude: number;
  Longitude: number;
  IsActive: boolean;
  CustomerID: number | null;
  CreatedAt: string;
  CustomerName: string | null;
}

// --- END REFINED INTERFACES ---


export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bins')
      .select<string, SupabaseBinDataWithCustomer>(`
        *,
        customer:customer!bins_c_id_fkey(c_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase GET error:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'No bin data found.' }, { status: 404 });
    }

    const binsWithCustomerNames: BinWithCustomerName[] = data.map(bin => ({
      BinID: bin.bin_id,         // Keep mapping bin_id
      BinPlate: bin.bin_plate,   // Map the new bin_plate
      Location: bin.label,
      Latitude: bin.latitude,
      Longitude: bin.longitude,
      IsActive: bin.is_active,
      CustomerID: bin.c_id,
      CreatedAt: bin.created_at,
      CustomerName: bin.customer?.c_name || null,
    }));

    return NextResponse.json(binsWithCustomerNames);
  } catch (error: unknown) {
    console.error('GET /api/bins error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Failed to fetch bins', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch bins', details: 'An unknown error occurred.' }, { status: 500 });
  }
}


// POST a new bin
export async function POST(request: NextRequest) {
  try {
    const { BinPlate, Location, Latitude, Longitude, IsActive, CustomerId }: BinCreateRequestBody = await request.json();

    if (!BinPlate || !Location || Latitude === undefined || Longitude === undefined) { // Now BinPlate is also required
      return NextResponse.json({ error: 'Missing required fields: BinPlate, Location, Latitude, and Longitude are required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bins')
      .insert([
        {
          bin_plate: BinPlate, // Insert the new bin_plate
          label: Location,
          latitude: Latitude,
          longitude: Longitude,
          is_active: IsActive === undefined ? true : IsActive,
          c_id: CustomerId || null
        },
      ])
      .select() // Select all columns of the inserted row
      .single();

    if (error) {
      throw error;
    }

    // After insertion, you might want to re-fetch the list to get the customer name
    // associated with the new bin, or enhance this response to include it directly.
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/bins error:', error);
    if (error instanceof Error) {
      if ('code' in error && error.code === '23505') { // Unique constraint violation, could be on bin_plate if you set it
          return NextResponse.json({ error: 'Failed to create bin. Bin Plate might already exist (if unique).', details: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create bin', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to create bin', details: 'An unknown error occurred.' }, { status: 500 });
  }
}

// PUT (update) an existing bin
export async function PUT(request: NextRequest) {
  try {
    const { BinID, BinPlate, Location, Latitude, Longitude, IsActive, CustomerId }: BinUpdateRequestBody = await request.json();

    if (!BinID) { // Still use BinID as the primary key for identifying the row
      return NextResponse.json({ error: 'BinID is required for updating.' }, { status: 400 });
    }

    const updateData: Partial<SupabaseBinRow> = {};
    if (BinPlate !== undefined) updateData.bin_plate = BinPlate; // Allow updating bin_plate
    if (Location !== undefined) updateData.label = Location;
    if (Latitude !== undefined) updateData.latitude = Latitude;
    if (Longitude !== undefined) updateData.longitude = Longitude;
    if (IsActive !== undefined) updateData.is_active = IsActive;
    if (CustomerId !== undefined) updateData.c_id = CustomerId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bins')
      .update(updateData)
      .eq('bin_id', BinID) // Still query by bin_id
      .select()
      .single();

    if (error) {
      throw error;
    }
    if (!data) {
      return NextResponse.json({ error: 'Bin not found or no changes made.' }, { status: 404 });
    }

    return NextResponse.json(data); // Returns raw SupabaseBinRow, consider re-fetching for frontend consistency
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

// DELETE a bin
export async function DELETE(request: NextRequest) {
  try {
    const { BinID }: BinDeleteRequestBody = await request.json(); // Still use BinID for deletion

    if (!BinID) {
      return NextResponse.json({ error: 'BinID is required for deletion.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bins')
      .delete()
      .eq('bin_id', BinID) // Still query by bin_id
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