// src/app/api/customers/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Make sure this path is correct

interface SupabaseCustomerRow {
  c_id: number;
  c_name: string;
  c_address: string; // Updated to c_address as per your database
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('customer') // Changed to 'customer' to match your database table name
      .select('c_id, c_name, c_address') // Updated to c_address for consistency
      .order('c_name', { ascending: true }); // Order by name for the dropdown

    if (error) {
      console.error('Supabase GET customers error:', error);
      // Return a structured error response
      return NextResponse.json(
        { message: 'Failed to fetch customers', details: error.message || 'Unknown Supabase error' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: 'No customer data found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Unexpected error in GET /api/customers:', error);
    if (error instanceof Error) {
      return NextResponse.json({ message: 'Failed to fetch customers', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Failed to fetch customers', details: 'An unknown error occurred.' }, { status: 500 });
  }
}

// POST a new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { CustomerName, CustomerAddress } = body; // Expecting both name and address from the frontend

    // Basic validation
    if (!CustomerName || typeof CustomerName !== 'string' || CustomerName.trim() === '') {
      return NextResponse.json({ message: 'Customer Name is required and must be a non-empty string.' }, { status: 400 });
    }
    if (!CustomerAddress || typeof CustomerAddress !== 'string' || CustomerAddress.trim() === '') {
      return NextResponse.json({ message: 'Customer Address is required and must be a non-empty string.' }, { status: 400 });
    }

    // Insert new customer into Supabase
    const { data, error } = await supabase
      .from('customer') // Changed to 'customer' to match your database table name
      .insert([
        {
          c_name: CustomerName.trim(),
          c_address: CustomerAddress.trim() // Updated to c_address for insertion
        },
      ])
      .select('c_id, c_name, c_address') // Updated to c_address for selection
      .single(); // Expecting a single new record

    if (error) {
      console.error('Supabase error adding customer:', error);
      if (error.code === '23505') { // PostgreSQL unique violation (if c_name has a unique constraint)
        return NextResponse.json(
          { message: 'Customer with this name already exists.', details: error.message || 'Duplicate entry error' },
          { status: 409 } // Conflict
        );
      }
      // For other Supabase errors
      return NextResponse.json(
        { message: 'Failed to add customer due to a database error.', details: error.message || 'Unknown database error' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 }); // Return the newly created customer with 201 Created status
  } catch (error: unknown) {
    // This catch block handles errors *before* Supabase is even called,
    // like if request.json() fails due to malformed JSON in the request body.
    console.error('Unexpected error in POST /api/customers:', error);
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return NextResponse.json(
            { message: 'Invalid JSON in request body.', details: error.message },
            { status: 400 } // Bad Request
        );
    }
    return NextResponse.json(
      { message: 'An unexpected error occurred while adding customer', details: (error instanceof Error) ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
