// src/app/api/dashboard/summary/route.ts
import { getConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pool = await getConnection();

    const [bins, trucks, pickupsToday] = await Promise.all([
      pool.request().query("SELECT COUNT(*) AS count FROM Bins"),
      pool.request().query("SELECT COUNT(*) AS count FROM Trucks"),
      pool.request().query(`
        SELECT COUNT(*) AS count FROM Pickups 
        WHERE CAST(ActualPickupTime AS DATE) = CAST(GETDATE() AS DATE)
      `),
    ]);

    return NextResponse.json({
      bins: bins.recordset[0].count,
      trucks: trucks.recordset[0].count,
      pickupsToday: pickupsToday.recordset[0].count,
    });
  } catch (err) {
    console.error("Summary error:", err);
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
