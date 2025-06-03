// src/app/api/customers/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Make sure this path is correct

interface SupabaseCustomerRow {
  c_id: number;
  c_name: string;
  // ... other customer fields you might have
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('customer') // Assuming your customer table is named 'customer'
      .select('c_id, c_name') // Select only the ID and name
      .order('c_name', { ascending: true }); // Order by name for the dropdown

    if (error) {
      console.error('Supabase GET customers error:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'No customer data found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('GET /api/customers error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Failed to fetch customers', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch customers', details: 'An unknown error occurred.' }, { status: 500 });
  }
}