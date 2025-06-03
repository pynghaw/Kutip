import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
  try {    
    const [bins, trucks, pickupsToday] = await Promise.all([
      supabase.from("bins").select("bin_id", { count: "exact", head: true }),
      supabase.from("trucks").select("truck_id", { count: "exact", head: true }),
      supabase
        .from("pickups")
        .select(`
          pickup_id,
          actual_pickup_time,
          p_status,
          pickup_status!pickups_p_status_fkey(p_status)
        `)        
    ]);

    // Debug: Log what pickups were found
    console.log("Pickups found:", pickupsToday.data);

    // Count successful and missed pickups
    let successful = 0;
    let missed = 0;
    
    // Count based on p_status values (assuming you know what they mean)
    if (pickupsToday.data) {
      for (const row of pickupsToday.data) {
        const statusId = row.p_status;        
       
        if (statusId === 1) { // Replace with correct ID for successful
          successful++;
        } else if (statusId === 2) { // Replace with correct ID for missed
          missed++;
        }
      }
    }

    return NextResponse.json({
      bins: bins.count ?? 0,
      trucks: trucks.count ?? 0,
      pickupsToday: pickupsToday.data?.length ?? 0,
      successfulPickups: successful,
      missedPickups: missed,
    });
  } catch (err) {
    console.error("Summary error:", err);
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
