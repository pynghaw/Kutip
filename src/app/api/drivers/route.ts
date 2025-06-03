// app/api/drivers/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Ensure this path is correct for your Supabase client

export async function GET() {
  try {
    // Select d_id and d_name from the 'driver' table
    const { data, error } = await supabase
      .from('driver') // Assuming your drivers table is named 'driver'
      .select('d_id, d_name') // Select the ID and name columns
      .order('d_name', { ascending: true }); // Order by name for better display

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to fetch drivers:', error);
    return NextResponse.json({ message: 'Failed to fetch drivers', details: error.message }, { status: 500 });
  }
}