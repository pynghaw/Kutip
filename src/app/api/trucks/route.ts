// src/app/api/trucks/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

// GET all trucks
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('trucks') // Supabase table name
      .select('*')    // Select all columns
      .order('created_at', { ascending: false }); // Assuming 'created_at' and desired order

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to fetch trucks:', error);
    return NextResponse.json({ message: 'Failed to fetch trucks', details: error.message }, { status: 500 });
  }
}

// POST a new truck
export async function POST(request: NextRequest) {
  try {
    const { PlateNo, DriverName, CapacityKg, IsActive } = await request.json();

    // Validate required fields (adjust table and column names as per your Supabase schema)
    if (!PlateNo || !DriverName || CapacityKg === undefined || IsActive === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    if (typeof PlateNo !== 'string' || PlateNo.trim() === '') {
        return NextResponse.json({ message: 'PlateNo must be a non-empty string' }, { status: 400 });
    }
    if (typeof DriverName !== 'string' || DriverName.trim() === '') {
        return NextResponse.json({ message: 'DriverName must be a non-empty string' }, { status: 400 });
    }
    if (typeof CapacityKg !== 'number' || CapacityKg <= 0) {
        return NextResponse.json({ message: 'CapacityKg must be a positive number' }, { status: 400 });
    }
    if (typeof IsActive !== 'boolean') {
        return NextResponse.json({ message: 'IsActive must be a boolean' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('trucks')
      .insert([
        {
          plate_no: PlateNo,       // Assuming 'plate_no'
          driver_name: DriverName, // Assuming 'driver_name'
          capacity_kg: CapacityKg, // Assuming 'capacity_kg'
          is_active: IsActive,     // Assuming 'is_active'
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create truck:', error);
    if (error.code === '23505') { // PostgreSQL unique violation (e.g. for plate_no if unique)
        return NextResponse.json({ message: 'Failed to create truck. Plate number might already exist.', details: error.message }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to create truck', details: error.message }, { status: 500 });
  }
}

// PUT (update) an existing truck
export async function PUT(request: NextRequest) {
  try {
    const { TruckID, PlateNo, DriverName, CapacityKg, IsActive } = await request.json();

    if (!TruckID || PlateNo === undefined || DriverName === undefined || CapacityKg === undefined || IsActive === undefined) {
      return NextResponse.json({ message: 'Missing required fields for update. TruckID and all fields to update are required.' }, { status: 400 });
    }
    if (typeof TruckID !== 'number') {
        return NextResponse.json({ message: 'TruckID must be a number' }, { status: 400 });
    }
    // Add other validations as in POST if needed

    const updateData: { [key: string]: any } = {};
    if (PlateNo !== undefined) updateData.plate_no = PlateNo;
    if (DriverName !== undefined) updateData.driver_name = DriverName;
    if (CapacityKg !== undefined) updateData.capacity_kg = CapacityKg;
    if (IsActive !== undefined) updateData.is_active = IsActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('trucks')
      .update(updateData)
      .eq('id', TruckID) // Assuming 'id' is the primary key in Supabase 'trucks' table
      .select()
      .single();

    if (error) throw error;
    if (!data) {
        return NextResponse.json({ message: `Truck with ID ${TruckID} not found or no changes made.` }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to update truck:', error);
    if (error.code === '23505') {
        return NextResponse.json({ message: 'Failed to update truck. Plate number might already exist for another truck.', details: error.message }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to update truck', details: error.message }, { status: 500 });
  }
}

// DELETE a truck
export async function DELETE(request: NextRequest) {
  try {
    const { TruckID } = await request.json(); // Assuming TruckID is passed in the body

    if (!TruckID) {
      return NextResponse.json({ message: 'TruckID is required for deletion' }, { status: 400 });
    }
    if (typeof TruckID !== 'number') {
        return NextResponse.json({ message: 'TruckID must be a number' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('trucks')
      .delete()
      .eq('id', TruckID) // Assuming 'id' is the primary key
      .select()
      .single();

    if (error) {
        if (error.code === '23503') { // PostgreSQL foreign key violation
            return NextResponse.json({ message: 'Failed to delete truck. It might be associated with other records.', details: error.message }, { status: 409 });
        }
        throw error;
    }

    if (!data) {
        return NextResponse.json({ message: `Truck with ID ${TruckID} not found.` }, { status: 404 });
    }

    return NextResponse.json({ message: `Truck with ID ${TruckID} deleted successfully.`, deletedTruck: data });
  } catch (error: any) {
    console.error('Failed to delete truck:', error);
    return NextResponse.json({ message: 'Failed to delete truck', details: error.message }, { status: 500 });
  }
}