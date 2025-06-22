import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';

// GET - Fetch all users
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, username, email, phone, role, first_name, last_name, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password, phone, role, first_name, last_name } = body;

    // Validation
    if (!username || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Username, email, password, and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'driver'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either "admin" or "driver"' },
        { status: 400 }
      );
    }

    // Check if username or email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
      }
      if (existingUser.email === email) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password_hash: passwordHash,
          phone: phone || null,
          role,
          first_name: first_name || null,
          last_name: last_name || null,
        }
      ])
      .select('user_id, username, email, phone, role, first_name, last_name, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 