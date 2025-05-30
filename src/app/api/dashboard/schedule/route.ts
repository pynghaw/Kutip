// In your pages/api/dashboard/schedule.ts (or relevant file)
import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

interface ScheduleItem {
  id: number;
  scheduled_time: string;
  status: string;
  trucks: {
    id: number;
    driver_name: string;
    plate_no: string;
  } | null; // Allow null in case the relation fails

  bins: {
    id: number;
    label: string;
  } | null;
}


export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const { data } = await supabase // Renamed 'error' to 'queryError' for clarity
      .from("truck_assignments")
      .select(`
        assignment_id,
        scheduled_time,
        status,
        trucks:truck_id (
          truck_id,
          driver_name,
          plate_no
        ),
        bins:bin_id (
          bin_id,
          label
        )
      `)
      .gte("scheduled_time", today)
      .lt("scheduled_time", tomorrow)
      .order("scheduled_time", { ascending: true });
    
    if (!data) {
      return NextResponse.json({ error: "No data" }, { status: 500 });
    }

    // *** IMPORTANT: Log the raw data from Supabase ***
    console.log("Raw data from Supabase:", JSON.stringify(data, null, 2));

    const safeData = data as unknown as ScheduleItem[]; // Type assertion

    const formatted = safeData.map((item) => ({
      assignmentId: item.id,
      truckId: item.trucks?.id ?? null,
      driverName: item.trucks?.driver_name ?? "Unknown",
      plateNo: item.trucks?.plate_no ?? "Unknown",
      binLabel: item.bins?.label ?? "Unknown",
      scheduledTime: item.scheduled_time,
      status: item.status,
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("General schedule error:", err); // Catch other potential errors
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}