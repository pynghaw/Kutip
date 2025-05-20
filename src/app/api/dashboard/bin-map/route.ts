// src/app/api/dashboard/bin-map/route.ts
import { getConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        BinID, Location, Latitude, Longitude, IsActive 
      FROM Bins
    `);

    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("Bin map error:", err);
    return NextResponse.json({ error: "Failed to load bins" }, { status: 500 });
  }
}
