import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("truck_assignments")
      .select(`
        scheduled_date,
        collection_status,
        bin_id,
        trucks:truck_id (
          plate_no,
          driver: d_id (
            d_name
          )
        )
      `)
      .order("scheduled_date", { ascending: true });

    if (error || !data) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
    }

    const formatted = data.map((item) => {
      const truck = Array.isArray(item.trucks) ? item.trucks[0] : item.trucks;
      const driver = truck?.driver && Array.isArray(truck.driver) ? truck.driver[0] : truck?.driver;

      return {
        plateNo: truck?.plate_no ?? "Unknown",
        driverName: driver?.d_name ?? "Unknown",
        binId: item.bin_id,
        scheduledDate: item.scheduled_date,
        collectionStatus: item.collection_status ? "Collected" : "Missed",
      };
    });

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
