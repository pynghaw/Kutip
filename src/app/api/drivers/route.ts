// src/app/api/drivers/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

// GET all drivers
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('driver') // Assuming your drivers table is named 'driver'
      .select('d_id, d_name') // Select d_id and d_name
      .order('d_name', { ascending: true }); // Order by driver name alphabetically

    if (error) {
      console.error('Supabase error fetching drivers:', error);
      // Return a structured error response
      return NextResponse.json(
        { message: 'Failed to fetch drivers', details: error.message || 'Unknown Supabase error' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Unexpected error in GET /api/drivers:', error);
    // Catch any other unexpected errors
    return NextResponse.json(
      { message: 'An unexpected error occurred while fetching drivers', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST a new driver
export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); // Safely parse the request body
    const { DriverName } = body; // Destructure DriverName

    // Basic validation
    if (!DriverName || typeof DriverName !== 'string' || DriverName.trim() === '') {
      return NextResponse.json({ message: 'DriverName is required and must be a non-empty string.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('driver') // Your drivers table name
      .insert([
        { d_name: DriverName.trim() }, // Insert the driver name, trim whitespace
      ])
      .select('d_id, d_name') // Select the newly created driver's id and name
      .single(); // Expecting a single new record

    if (error) {
      console.error('Supabase error adding driver:', error);
      if (error.code === '23505') { // PostgreSQL unique violation (if d_name is unique)
        return NextResponse.json(
          { message: 'Driver with this name already exists.', details: error.message || 'Duplicate entry error' },
          { status: 409 } // Conflict
        );
      }
      // For other Supabase errors
      return NextResponse.json(
        { message: 'Failed to add driver due to a database error.', details: error.message || 'Unknown database error' },
        { status: 500 }
      );
    }

    // Successfully created
    return NextResponse.json(data, { status: 201 }); // Return the newly created driver with 201 Created status
  } catch (error: any) {
    // This catch block handles errors *before* Supabase is even called,
    // like if request.json() fails due to malformed JSON in the request body.
    console.error('Unexpected error in POST /api/drivers:', error);
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return NextResponse.json(
            { message: 'Invalid JSON in request body.', details: error.message },
            { status: 400 } // Bad Request
        );
    }
    return NextResponse.json(
      { message: 'An unexpected error occurred while adding driver', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// You can add PUT and DELETE functions here if needed, following similar error handling patterns.