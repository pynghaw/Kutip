import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    
    // Clear cookies
    response.cookies.set('user', '', { maxAge: 0, path: '/' });
    response.cookies.set('isLoggedIn', '', { maxAge: 0, path: '/' });
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 