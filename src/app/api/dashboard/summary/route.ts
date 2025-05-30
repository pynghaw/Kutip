// src/app/api/dashboard/summary/route.ts
import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch all 3 counts in parallel
    const [bins, trucks, pickups] = await Promise.all([
      supabase.from("bins").select("bin_id", { count: "exact", head: true }),
      supabase.from("trucks").select("truck_id", { count: "exact", head: true }),
      supabase.from("pickups").select("pickup_id", { count: "exact", head: true })
    ]);

    return NextResponse.json({
      bins: bins.count ?? 0,
      trucks: trucks.count ?? 0,
      pickupsToday: pickups.count ?? 0,
    });
  } catch (err) {
    console.error("Summary error:", err);
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
