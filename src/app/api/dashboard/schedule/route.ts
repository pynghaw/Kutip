import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch all truck assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("truck_assignments")
      .select("scheduled_date, collection_status, bin_id, truck_id")
      .order("scheduled_date", { ascending: true });

    if (assignmentsError || !assignments) {
      console.error("Supabase error (assignments):", assignmentsError);
      return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
    }

    // Fetch all trucks
    const { data: trucks, error: trucksError } = await supabase
      .from("trucks")
      .select("truck_id, plate_no, d_id");

    if (trucksError || !trucks) {
      console.error("Supabase error (trucks):", trucksError);
      return NextResponse.json({ error: "Failed to fetch trucks" }, { status: 500 });
    }

    // Fetch all users with role 'driver'
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("user_id, first_name, last_name, username, role")
      .eq("role", "driver");

    if (usersError || !users) {
      console.error("Supabase error (users):", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Manually join assignments -> trucks -> users
    const formatted = assignments.map((item) => {
      const truck = trucks.find(t => t.truck_id === item.truck_id);
      const driver = truck ? users.find(u => u.user_id === truck.d_id) : null;
      let driverName = "Unknown";
      if (driver) {
        if (driver.first_name && driver.last_name) {
          driverName = `${driver.first_name} ${driver.last_name}`;
        } else if (driver.username) {
          driverName = driver.username;
        }
      }
      return {
        plateNo: truck?.plate_no ?? "Unknown",
        driverName,
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
