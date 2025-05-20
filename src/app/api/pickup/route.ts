// src/app/api/bins/route.ts
import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT TOP (1000) [PickupID],[AssignmentID],[ActualPickupTime]  ,[PhotoUrl]  ,[Missed],[Notes],[CreatedAt] FROM [db_kutip].[dbo].[Pickups]');
    return NextResponse.json(result.recordset);
  } catch (error) {
    return NextResponse.json({ error: 'DB Error', details: error }, { status: 500 });
  }
}
