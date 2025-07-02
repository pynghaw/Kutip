import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    // Get the current user from the request headers or query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the driver's truck
    const { data: truck, error: truckError } = await supabase
      .from('trucks')
      .select('*')
      .eq('d_id', parseInt(userId))
      .single();

    if (truckError || !truck) {
      return NextResponse.json(
        { error: 'No truck assigned to this driver' },
        { status: 404 }
      );
    }

    // Find active schedules (in_progress) for today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select(`
        *,
        routes!inner(
          route_id,
          route_name,
          status,
          truck_id,
          started_at,
          completed_at
        )
      `)
      .eq('scheduled_date', today)
      .eq('status', 'in_progress')
      .eq('routes.truck_id', truck.truck_id)
      .eq('routes.status', 'in_progress');

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return NextResponse.json(
        { error: 'Failed to fetch active schedules' },
        { status: 500 }
      );
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json(
        { message: 'No active schedules found for today' },
        { status: 404 }
      );
    }

    // Return the first active schedule (there should typically be only one)
    const activeSchedule = schedules[0];
    
    // Find the specific route for this truck
    const activeRoute = activeSchedule.routes.find(
      (route: any) => route.truck_id === truck.truck_id && route.status === 'in_progress'
    );

    return NextResponse.json({
      success: true,
      schedule: {
        schedule_id: activeSchedule.schedule_id,
        schedule_name: activeSchedule.schedule_name,
        scheduled_date: activeSchedule.scheduled_date,
        status: activeSchedule.status
      },
      route: activeRoute ? {
        route_id: activeRoute.route_id,
        route_name: activeRoute.route_name,
        status: activeRoute.status,
        started_at: activeRoute.started_at
      } : null,
      truck: {
        truck_id: truck.truck_id,
        plate_no: truck.plate_no
      }
    });

  } catch (error) {
    console.error('Error getting active schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 