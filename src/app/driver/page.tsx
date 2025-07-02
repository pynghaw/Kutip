"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BinMap from '@/components/maps/BinMap';
import { supabase } from '@/lib/supabaseClient';

interface User {
  user_id: number;
  username: string;
  email: string;
  role: 'admin' | 'driver';
  first_name: string | null;
  last_name: string | null;
}

export default function DriverDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [truck, setTruck] = useState<any | null>(null);
  const [truckLoading, setTruckLoading] = useState(false);

  useEffect(() => {
    // Check if user is logged in and is a driver
    const userData = localStorage.getItem('user');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (!isLoggedIn || !userData) {
      router.push('/signin');
      return;
    }

    try {
      const userObj = JSON.parse(userData);
      if (userObj.role !== 'driver') {
        // If not a driver, redirect to appropriate page
        if (userObj.role === 'admin') {
          router.push('/driver');
        } else {
          router.push('/signin');
        }
        return;
      }
      setUser(userObj);
    } catch (error) {
      router.push('/signin');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const fetchTruck = async () => {
      if (!user) return;
      setTruckLoading(true);
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .eq('d_id', user.user_id)
        .single();
      if (!error && data) {
        setTruck(data);
      } else {
        setTruck(null);
      }
      setTruckLoading(false);
    };
    fetchTruck();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Welcome back, {user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}` 
            : user.username}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Here's your overview
        </p>
        {/* Truck Assignment Section */}
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Your Assigned Truck</h2>
          {truckLoading ? (
            <div className="text-gray-500">Loading truck info...</div>
          ) : truck ? (
            <div className="flex items-center space-x-4">
              <span className="font-medium text-gray-700 dark:text-gray-200">Plate No:</span>
              <span className="text-gray-900 dark:text-white">{truck.plate_no}</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${truck.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{truck.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          ) : (
            <div className="text-gray-500">No truck assigned to you.</div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => router.push('/driver/schedule')}
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-left">
              <h3 className="font-medium text-gray-800 dark:text-white">View Schedule</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Check today's pickups</p>
            </div>
          </button>

          <button 
            onClick={() => router.push('/driver/camera')}
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <svg className="w-8 h-8 text-green-600 dark:text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <div className="text-left">
              <h3 className="font-medium text-gray-800 dark:text-white">Open Camera</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Access camera system</p>
            </div>
          </button>

          <button 
            onClick={() => router.push('/driver/profile')}
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div className="text-left">
              <h3 className="font-medium text-gray-800 dark:text-white">My Profile</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Update your information</p>
            </div>
          </button>
        </div>
      </div>

      {/* Bin Map */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Bin Locations
        </h2>
        <div className="h-96 rounded-lg overflow-hidden">
          <BinMap />
        </div>
      </div>
    </div>
  );
} 