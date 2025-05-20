// src/app/api/bins/route.ts
import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

import { NextRequest } from 'next/server';

export async function GET() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT TOP (1000) [BinID], [Location], [Latitude], [Longitude], [IsActive], [CreatedAt] FROM [db_kutip].[dbo].[Bins]');
    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('GET /api/bins error:', error);
    return NextResponse.json({ error: 'Failed to fetch bins', details: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { Location, Latitude, Longitude, IsActive } = await request.json();
    if (!Location || Latitude === undefined || Longitude === undefined) {
      return NextResponse.json({ error: 'Missing required fields: Location, Latitude, and Longitude are required.' }, { status: 400 });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('Location', Location)
      .input('Latitude', Latitude)
      .input('Longitude', Longitude)
      .input('IsActive', IsActive === undefined ? true : IsActive) // Default to true if not provided
      .query('INSERT INTO [db_kutip].[dbo].[Bins] (Location, Latitude, Longitude, IsActive) OUTPUT INSERTED.* VALUES (@Location, @Latitude, @Longitude, @IsActive)');
    
    return NextResponse.json(result.recordset[0], { status: 201 });
  } catch (error) {
    console.error('POST /api/bins error:', error);
    return NextResponse.json({ error: 'Failed to create bin', details: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { BinID, Location, Latitude, Longitude, IsActive } = await request.json();
    if (!BinID) {
      return NextResponse.json({ error: 'BinID is required for updating.' }, { status: 400 });
    }

    const pool = await getConnection();
    let query = 'UPDATE [db_kutip].[dbo].[Bins] SET ';
    const params: { name: string, value: unknown }[] = [];
    const setClauses: string[] = [];

    if (Location !== undefined) { 
      setClauses.push('[Location] = @Location');
      params.push({ name: 'Location', value: Location });
    }
    if (Latitude !== undefined) { 
      setClauses.push('[Latitude] = @Latitude');
      params.push({ name: 'Latitude', value: Latitude });
    }
    if (Longitude !== undefined) { 
      setClauses.push('[Longitude] = @Longitude');
      params.push({ name: 'Longitude', value: Longitude });
    }
    if (IsActive !== undefined) { 
      setClauses.push('[IsActive] = @IsActive');
      params.push({ name: 'IsActive', value: IsActive });
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    query += setClauses.join(', ') + ' OUTPUT INSERTED.* WHERE [BinID] = @BinID';
    params.push({ name: 'BinID', value: BinID });

    const requestInstance = pool.request();
    params.forEach(p => requestInstance.input(p.name, p.value));
    
    const result = await requestInstance.query(query);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'Bin not found or no changes made.' }, { status: 404 });
    }
    
    return NextResponse.json(result.recordset[0]);
  } catch (error) {
    console.error('PUT /api/bins error:', error);
    return NextResponse.json({ error: 'Failed to update bin', details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { BinID } = await request.json();
    if (!BinID) {
      return NextResponse.json({ error: 'BinID is required for deletion.' }, { status: 400 });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('BinID', BinID)
      .query('DELETE FROM [db_kutip].[dbo].[Bins] OUTPUT DELETED.* WHERE [BinID] = @BinID');

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'Bin not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Bin deleted successfully', deletedBin: result.recordset[0] });
  } catch (error) {
    console.error('DELETE /api/bins error:', error);
    return NextResponse.json({ error: 'Failed to delete bin', details: (error as Error).message }, { status: 500 });
  }
}
