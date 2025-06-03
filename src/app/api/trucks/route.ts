import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

// GET all trucks
export async function GET() {
  try {
    // Select all columns from 'trucks' and also fetch 'd_name' from the 'driver' table
    // Ensure 'd_name' is the correct column name in your 'driver' table
    const { data, error } = await supabase
      .from('trucks') // Supabase table name
      .select('*, driver(d_name)')
      .order('created_at', { ascending: false }); // Assuming 'created_at' and desired order

    if (error) throw error;

    // Map the data to flatten the driver_name into the truck object
    const trucksWithDriverName = data.map((truck: any) => ({
      ...truck,
      DriverName: truck.driver ? truck.driver.d_name : null, // Extract d_name from 'driver' object
      driver: undefined, // Remove the nested 'driver' object to flatten the structure
    }));

    return NextResponse.json(trucksWithDriverName);
  } catch (error: any) {
    console.error('Failed to fetch trucks:', error);
    return NextResponse.json({ message: 'Failed to fetch trucks', details: error.message }, { status: 500 });
  }
}

// POST a new truck
export async function POST(request: NextRequest) {
  try {
    const { PlateNo, DriverID, IsActive } = await request.json();

    // Validate required fields
    if (!PlateNo || DriverID === undefined || IsActive === undefined) {
      return NextResponse.json({ message: 'Missing required fields: PlateNo, DriverID, IsActive' }, { status: 400 });
    }
    if (typeof PlateNo !== 'string' || PlateNo.trim() === '') {
      return NextResponse.json({ message: 'PlateNo must be a non-empty string' }, { status: 400 });
    }
    if (typeof DriverID !== 'number' || DriverID <= 0) {
      return NextResponse.json({ message: 'DriverID must be a positive number' }, { status: 400 });
    }
    if (typeof IsActive !== 'boolean') {
      return NextResponse.json({ message: 'IsActive must be a boolean' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('trucks')
      .insert([
        {
          plate_no: PlateNo,
          d_id: DriverID, // Link to driver by d_id
          is_active: IsActive,
        },
      ])
      .select()
      .single(); // Use .single() if you expect only one row back

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
    const { TruckID, PlateNo, DriverID, IsActive } = await request.json();

    if (!TruckID || (PlateNo === undefined && DriverID === undefined && IsActive === undefined)) {
      return NextResponse.json({ message: 'Missing TruckID or no fields to update.' }, { status: 400 });
    }
    if (typeof TruckID !== 'number') {
      return NextResponse.json({ message: 'TruckID must be a number' }, { status: 400 });
    }

    const updateData: { [key: string]: any } = {};
    if (PlateNo !== undefined) updateData.plate_no = PlateNo;
    if (DriverID !== undefined) {
        if (typeof DriverID !== 'number' || DriverID <= 0) {
            return NextResponse.json({ message: 'DriverID must be a positive number if provided' }, { status: 400 });
        }
        updateData.d_id = DriverID; // Update driver by d_id
    }
    if (IsActive !== undefined) {
        if (typeof IsActive !== 'boolean') {
            return NextResponse.json({ message: 'IsActive must be a boolean if provided' }, { status: 400 });
        }
        updateData.is_active = IsActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update provided.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('trucks')
      .update(updateData)
      .eq('truck_id', TruckID) // Changed from 'id' to 'truck_id'
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
      .eq('truck_id', TruckID) // Changed from 'id' to 'truck_id'
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