import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    // Fetch all pickups in the last 7 days with actual pickup times
    const { data, error } = await supabase
      .from("pickups")
      .select("actual_pickup_time")
      .gte("actual_pickup_time", sevenDaysAgo.toISOString())
      .lte("actual_pickup_time", today.toISOString());

    if (error || !data) {
      console.error("Supabase pickup trends error:", error);
      return NextResponse.json({ error: "Failed to load trends" }, { status: 500 });
    }

    // Group pickups by date string (YYYY-MM-DD) and count
    const trends: Record<string, number> = {};

    data.forEach((row) => {
      const date = new Date(row.actual_pickup_time).toISOString().split("T")[0]; // e.g. "2025-07-15"
      trends[date] = (trends[date] || 0) + 1;
    });

    // Format the result as an array sorted by date
    const result = Object.entries(trends)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Trends error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
