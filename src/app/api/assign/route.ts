// src/app/api/assign/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Keep private, server only
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('truck_assignments') // use your actual table name here
      .select('id, truck_id, bin_id, scheduled_time, status, created_at')
      .limit(1000);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Supabase Error', details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
}
