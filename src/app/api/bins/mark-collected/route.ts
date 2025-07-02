import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { plate_number, schedule_id, route_id } = await request.json();

    if (!plate_number || !schedule_id) {
      return NextResponse.json(
        { error: 'Plate number and schedule ID are required' },
        { status: 400 }
      );
    }

    // First, find the bin with this plate number
    const { data: bin, error: binError } = await supabase
      .from('bins')
      .select('*')
      .eq('bin_plate', plate_number)
      .single();

    if (binError || !bin) {
      return NextResponse.json(
        { error: `Bin with plate ${plate_number} not found` },
        { status: 404 }
      );
    }

    // Find the assignment for this bin in the current schedule
    const { data: assignment, error: assignmentError } = await supabase
      .from('truck_assignments')
      .select('*')
      .eq('bin_id', bin.bin_id)
      .eq('schedule_id', schedule_id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: `Assignment not found for bin ${plate_number} in schedule ${schedule_id}` },
        { status: 404 }
      );
    }

    // Update the assignment to mark it as collected
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('truck_assignments')
      .update({ 
        collected_at: new Date().toISOString(),
        status: 'collected'
      })
      .eq('assignment_id', assignment.assignment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating assignment:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark bin as collected' },
        { status: 500 }
      );
    }

    // Check if all bins in this route are collected
    const { data: routeAssignments, error: routeAssignmentsError } = await supabase
      .from('truck_assignments')
      .select('*')
      .eq('truck_id', assignment.truck_id)
      .eq('schedule_id', schedule_id);

    if (!routeAssignmentsError && routeAssignments) {
      const allCollected = routeAssignments.every(a => a.status === 'collected');
      
      if (allCollected && route_id) {
        // Mark the route as completed
        await supabase
          .from('routes')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('route_id', route_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bin ${plate_number} marked as collected`,
      assignment: updatedAssignment
    });

  } catch (error) {
    console.error('Error marking bin as collected:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 