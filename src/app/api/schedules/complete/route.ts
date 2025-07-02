import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { schedule_id, route_id } = await request.json();

    if (!schedule_id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // Update the schedule status to completed
    const { data: updatedSchedule, error: scheduleError } = await supabase
      .from('schedules')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('schedule_id', schedule_id)
      .select()
      .single();

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError);
      return NextResponse.json(
        { error: 'Failed to update schedule status' },
        { status: 500 }
      );
    }

    // If route_id is provided, also update the route status
    if (route_id) {
      const { error: routeError } = await supabase
        .from('routes')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('route_id', route_id);

      if (routeError) {
        console.error('Error updating route:', routeError);
        // Don't fail the entire request if route update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Schedule ${schedule_id} marked as completed`,
      schedule: updatedSchedule
    });

  } catch (error) {
    console.error('Error completing schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 