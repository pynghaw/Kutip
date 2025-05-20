// src/app/api/dashboard/schedule/route.ts
import { getConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        TA.AssignmentID,
        T.TruckID, T.DriverName, T.PlateNo,
        B.Location AS BinLocation,
        TA.ScheduledTime,
        TA.Status
      FROM TruckAssignments TA
      JOIN Trucks T ON TA.TruckID = T.TruckID
      JOIN Bins B ON TA.BinID = B.BinID
      WHERE CAST(TA.ScheduledTime AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY TA.ScheduledTime ASC
    `);

    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("Schedule error:", err);
    return NextResponse.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}
