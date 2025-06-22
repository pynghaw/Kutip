import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT (update) user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { username, email, phone, role, first_name, last_name, is_active } = body;

    // Validation
    if (!username || !email || !role) {
      return NextResponse.json(
        { error: 'Username, email, and role are required' },
        { status: 400 }
      );
    }

    // Check if username or email already exists for other users
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('user_id, username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .neq('user_id', params.id);

    if (checkError) {
      return NextResponse.json(
        { error: 'Error checking existing users' },
        { status: 500 }
      );
    }

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.username === username) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        );
      }
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Update user
    const { data, error } = await supabase
      .from('users')
      .update({
        username,
        email,
        phone: phone || null,
        role,
        first_name: first_name || null,
        last_name: last_name || null,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', params.id)
      .single();

    if (checkError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', params.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 