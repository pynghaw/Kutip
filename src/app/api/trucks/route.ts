// src/app/api/trucks/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getConnection } from '@/lib/db'; // Assuming this correctly returns a mssql.ConnectionPool
import sql from 'mssql'; // Import sql object for parameterized queries

// GET all trucks
export async function GET() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        [TruckID],
        [PlateNo],
        [DriverName],
        [CapacityKg],
        [IsActive],
        [CreatedAt] 
      FROM [db_kutip].[dbo].[Trucks]
      ORDER BY [CreatedAt] DESC; 
    `); // Added ORDER BY for consistency
    return NextResponse.json(result.recordset);
  } catch (error: unknown) {
    console.error('Failed to fetch trucks:', error);
    return NextResponse.json({ message: 'Failed to fetch trucks', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// POST a new truck
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { PlateNo, DriverName, CapacityKg, IsActive } = body;

    if (!PlateNo || !DriverName || CapacityKg === undefined || IsActive === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    
    // Basic validation (can be expanded)
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


    const pool = await getConnection();
    const result = await pool.request()
      .input('PlateNo', sql.NVarChar, PlateNo)
      .input('DriverName', sql.NVarChar, DriverName)
      .input('CapacityKg', sql.Decimal(10, 2), CapacityKg) // Adjust sql.Decimal precision and scale as needed
      .input('IsActive', sql.Bit, IsActive)
      .query(`
        INSERT INTO [db_kutip].[dbo].[Trucks] (PlateNo, DriverName, CapacityKg, IsActive)
        OUTPUT INSERTED.TruckID, INSERTED.PlateNo, INSERTED.DriverName, INSERTED.CapacityKg, INSERTED.IsActive, INSERTED.CreatedAt
        VALUES (@PlateNo, @DriverName, @CapacityKg, @IsActive);
      `);

    if (result.recordset && result.recordset.length > 0) {
      return NextResponse.json(result.recordset[0], { status: 201 });
    } else {
      return NextResponse.json({ message: 'Failed to create truck, no record returned.' }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('Failed to create truck:', error);
    // Check for specific SQL errors, e.g., unique constraint violation
    if ((error as sql.RequestError).number === 2627 || (error as sql.RequestError).number === 2601) { // SQL Server error codes for unique constraint violation
        return NextResponse.json({ message: 'Failed to create truck. Plate number might already exist.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ message: 'Failed to create truck', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT (update) an existing truck
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { TruckID, PlateNo, DriverName, CapacityKg, IsActive } = body;

    if (!TruckID || !PlateNo || !DriverName || CapacityKg === undefined || IsActive === undefined) {
      return NextResponse.json({ message: 'Missing required fields for update' }, { status: 400 });
    }

    // Basic validation (can be expanded)
    if (typeof TruckID !== 'number') {
        return NextResponse.json({ message: 'TruckID must be a number' }, { status: 400 });
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

    const pool = await getConnection();
    const result = await pool.request()
      .input('TruckID', sql.Int, TruckID)
      .input('PlateNo', sql.NVarChar, PlateNo)
      .input('DriverName', sql.NVarChar, DriverName)
      .input('CapacityKg', sql.Decimal(10, 2), CapacityKg)
      .input('IsActive', sql.Bit, IsActive)
      .query(`
        UPDATE [db_kutip].[dbo].[Trucks]
        SET PlateNo = @PlateNo,
            DriverName = @DriverName,
            CapacityKg = @CapacityKg,
            IsActive = @IsActive
        OUTPUT INSERTED.TruckID, INSERTED.PlateNo, INSERTED.DriverName, INSERTED.CapacityKg, INSERTED.IsActive, INSERTED.CreatedAt
        WHERE TruckID = @TruckID;
      `);

    if (result.recordset && result.recordset.length > 0) {
      return NextResponse.json(result.recordset[0]);
    } else {
      return NextResponse.json({ message: `Truck with ID ${TruckID} not found or no changes made.` }, { status: 404 });
    }

  } catch (error: unknown) {
    console.error('Failed to update truck:', error);
     // Check for specific SQL errors, e.g., unique constraint violation on PlateNo if it's unique
    if ((error as sql.RequestError).number === 2627 || (error as sql.RequestError).number === 2601) {
        return NextResponse.json({ message: 'Failed to update truck. Plate number might already exist for another truck.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to update truck', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// DELETE a truck
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { TruckID } = body;

    if (!TruckID) {
      return NextResponse.json({ message: 'TruckID is required for deletion' }, { status: 400 });
    }
    if (typeof TruckID !== 'number') {
        return NextResponse.json({ message: 'TruckID must be a number' }, { status: 400 });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('TruckID', sql.Int, TruckID)
      .query(`
        DELETE FROM [db_kutip].[dbo].[Trucks]
        OUTPUT DELETED.TruckID 
        WHERE TruckID = @TruckID;
      `);

    if (result.recordset && result.recordset.length > 0) {
      return NextResponse.json({ message: `Truck with ID ${TruckID} deleted successfully.` });
    } else {
      return NextResponse.json({ message: `Truck with ID ${TruckID} not found.` }, { status: 404 });
    }

  } catch (error: unknown) {
    console.error('Failed to delete truck:', error);
    // Check for foreign key constraint errors if trucks are referenced elsewhere
    if ((error as sql.RequestError).number === 547) { // SQL Server error code for foreign key constraint violation
        return NextResponse.json({ message: 'Failed to delete truck. It might be associated with other records (e.g., trips or assignments).', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to delete truck', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}