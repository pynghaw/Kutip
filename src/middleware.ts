import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public paths that don't require authentication
  const publicPaths = ['/signin', '/signup'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Check if user is authenticated
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value === 'true';
  const userData = request.cookies.get('user')?.value;
  
  // If user is not logged in and trying to access protected routes
  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }
  
  // If user is logged in and trying to access public paths (signin/signup)
  if (isLoggedIn && isPublicPath) {
    try {
      const user = userData ? JSON.parse(userData) : null;
      if (user) {
        // Allow admin to access /signup
        if (pathname.startsWith('/signup') && user.role === 'admin') {
          // Do not redirect, allow access
        } else {
          // Redirect based on role
          if (user.role === 'admin') {
            return NextResponse.redirect(new URL('/', request.url));
          } else if (user.role === 'driver') {
            return NextResponse.redirect(new URL('/driver', request.url));
          }
        }
      }
    } catch (error) {
      // If user data is invalid, redirect to signin
      return NextResponse.redirect(new URL('/signin', request.url));
    }
  }
  
  // If user is logged in, check role-based access
  if (isLoggedIn && userData) {
    try {
      const user = JSON.parse(userData);
      
      // Admin routes protection
      if (pathname.startsWith('/') && !pathname.startsWith('/driver') && !pathname.startsWith('/signin') && !pathname.startsWith('/signup') && pathname !== '/') {
        if (user.role !== 'admin') {
          // Non-admin trying to access admin routes
          if (user.role === 'driver') {
            return NextResponse.redirect(new URL('/driver', request.url));
          } else {
            return NextResponse.redirect(new URL('/signin', request.url));
          }
        }
      }
      
      // Driver routes protection
      if (pathname.startsWith('/driver')) {
        if (user.role !== 'driver') {
          // Non-driver trying to access driver routes
          if (user.role === 'admin') {
            return NextResponse.redirect(new URL('/', request.url));
          } else {
            return NextResponse.redirect(new URL('/signin', request.url));
          }
        }
      }
    } catch (error) {
      // If user data is invalid, redirect to signin
      return NextResponse.redirect(new URL('/signin', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 