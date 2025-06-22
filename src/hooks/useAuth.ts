import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  user_id: number;
  username: string;
  email: string;
  role: 'admin' | 'driver';
  first_name: string | null;
  last_name: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (!isLoggedIn || !userData) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userObj = JSON.parse(userData);
      setUser(userObj);
    } catch (error) {
      console.error('Error parsing user data:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      // Call logout API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        
        // Clear cookies
        document.cookie = 'user=; path=/; max-age=0';
        document.cookie = 'isLoggedIn=; path=/; max-age=0';
        
        setUser(null);
        
        // Redirect to signin
        router.push('/signin');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API fails, clear local data and redirect
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      document.cookie = 'user=; path=/; max-age=0';
      document.cookie = 'isLoggedIn=; path=/; max-age=0';
      setUser(null);
      router.push('/signin');
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isDriver = user?.role === 'driver';

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    isDriver,
    logout,
  };
} 