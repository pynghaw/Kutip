// src/app/api/bins/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

// GET all bins
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bins') // Supabase table name
      .select('*') // Select all columns
      .order('created_at', { ascending: false }); // Assuming 'created_at' column and desired order

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('GET /api/bins error:', error);
    return NextResponse.json({ error: 'Failed to fetch bins', details: error.message }, { status: 500 });
  }
}

// POST a new bin
export async function POST(request: NextRequest) {
  try {
    const { Location, Latitude, Longitude, IsActive } = await request.json();

    // Validate required fields (adjust table and column names as per your Supabase schema)
    if (!Location || Latitude === undefined || Longitude === undefined) {
      return NextResponse.json({ error: 'Missing required fields: Location, Latitude, and Longitude are required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bins')
      .insert([
        {
          label: Location, // Assuming 'label' is the column name in Supabase for Location
          latitude: Latitude,
          longitude: Longitude,
          is_active: IsActive === undefined ? true : IsActive, // Assuming 'is_active'
          // created_at will likely be handled by Supabase (e.g. default now())
        },
      ])
      .select() // Return the inserted record
      .single(); // Expect a single record

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/bins error:', error);
    // Handle potential Supabase-specific errors, e.g., unique constraint violations
    if (error.code === '23505') { // PostgreSQL unique violation error code
        return NextResponse.json({ error: 'Failed to create bin. Location might already exist.', details: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create bin', details: error.message }, { status: 500 });
  }
}

// PUT (update) an existing bin
export async function PUT(request: NextRequest) {
  try {
    const { BinID, Location, Latitude, Longitude, IsActive } = await request.json();

    if (!BinID) {
      return NextResponse.json({ error: 'BinID (or your primary key for bins) is required for updating.' }, { status: 400 });
    }

    const updateData: { [key: string]: any } = {};
    if (Location !== undefined) updateData.label = Location; // Assuming 'label' for Location
    if (Latitude !== undefined) updateData.latitude = Latitude;
    if (Longitude !== undefined) updateData.longitude = Longitude;
    if (IsActive !== undefined) updateData.is_active = IsActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bins')
      .update(updateData)
      .eq('id', BinID) // Assuming 'id' is the primary key column name in your Supabase 'bins' table
      .select()
      .single();

    if (error) throw error;
    if (!data) {
        return NextResponse.json({ error: 'Bin not found or no changes made.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('PUT /api/bins error:', error);
    if (error.code === '23505') { 
        return NextResponse.json({ error: 'Failed to update bin. Location might already exist for another bin.', details: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update bin', details: error.message }, { status: 500 });
  }
}

// DELETE a bin
export async function DELETE(request: NextRequest) {
  try {
    const { BinID } = await request.json(); // Assuming BinID is passed in the body

    if (!BinID) {
      return NextResponse.json({ error: 'BinID (or your primary key) is required for deletion.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bins')
      .delete()
      .eq('id', BinID) // Assuming 'id' is the primary key
      .select()       // Optionally select the deleted row to confirm
      .single();      // Expect a single record or null if not found

    if (error) {
        // Check for foreign key violation if bins are referenced elsewhere
        if (error.code === '23503') { // PostgreSQL foreign key violation
            return NextResponse.json({ error: 'Failed to delete bin. It might be referenced by other records (e.g., assignments).', details: error.message }, { status: 409 });
        }
        throw error;
    }
    
    if (!data) {
        return NextResponse.json({ error: 'Bin not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Bin deleted successfully', deletedBin: data });
  } catch (error: any) {
    console.error('DELETE /api/bins error:', error);
    return NextResponse.json({ error: 'Failed to delete bin', details: error.message }, { status: 500 });
  }
}
