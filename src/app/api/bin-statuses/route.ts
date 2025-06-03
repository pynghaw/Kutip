// src/app/api/bin-statuses/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

interface BinStatus {
  status_id: number;
  status: string; // CHANGED: Column name is 'status'
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bin_status')
      .select('status_id, status') // CHANGED: Select 'status'
      .order('status', { ascending: true }); // Order by 'status' for consistent display

    if (error) {
      console.error('Supabase GET bin statuses error:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'No bin status data found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('GET /api/bin-statuses error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Failed to fetch bin statuses', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch bin statuses', details: 'An unknown error occurred.' }, { status: 500 });
  }
}