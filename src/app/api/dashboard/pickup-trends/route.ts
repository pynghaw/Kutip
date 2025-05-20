// src/app/api/dashboard/pickup-trends/route.ts
import { getConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        CAST(ActualPickupTime AS DATE) AS date,
        COUNT(*) AS count
      FROM Pickups
      WHERE ActualPickupTime IS NOT NULL
        AND ActualPickupTime >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
      GROUP BY CAST(ActualPickupTime AS DATE)
      ORDER BY date ASC
    `);

    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("Trends error:", err);
    return NextResponse.json({ error: "Failed to load trends" }, { status: 500 });
  }
}
