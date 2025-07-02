"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('user');

    if (isLoggedIn && userData) {
      try {
        const user = JSON.parse(userData);
        // Redirect based on user role
        if (user.role === 'driver') {
          router.push('/driver');
        } else if (user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/signin');
        }
      } catch (error) {
        // If user data is corrupted, redirect to signin
        router.push('/signin');
      }
    } else {
      // Not logged in, redirect to signin
      router.push('/signin');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
} 