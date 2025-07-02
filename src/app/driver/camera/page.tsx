"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CameraViewer from "@/components/camera/CameraViewer";
import { supabase } from '@/lib/supabaseClient';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface User {
  user_id: number;
  username: string;
  email: string;
  role: 'admin' | 'driver';
  first_name: string | null;
  last_name: string | null;
}

interface Bin {
  bin_id: number;
  label: string;
  latitude: number;
  longitude: number;
  status_id: number;
  c_id: number;
  bin_plate: string;
  area: string;
}

interface Route {
  route_id?: number;
  route_name: string;
  truck_id: number;
  scheduled_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  total_bins?: number;
  schedule_id?: number;
  started_at?: string;
  completed_at?: string;
}

interface Schedule {
  schedule_id?: number;
  schedule_name: string;
  scheduled_date: string;
  created_at?: string;
  total_trucks: number;
  total_bins: number;
  total_routes: number;
  description?: string;
  status?: string;
}

interface TruckAssignment {
  assignment_id?: number;
  truck_id: number;
  bin_id: number;
  scheduled_date: string;
  schedule_id?: number;
  status?: string;
  collected_at?: string;
}

// Collection Center coordinates (same as schedule detail page)
const COLLECTION_CENTER = {
  lat: 1.5341,
  lng: 103.6217,
  name: "Collection Center"
};

export default function DriverCameraPage() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeBins, setRouteBins] = useState<(Bin & { isCollected?: boolean; collectedAt?: string; collectionOrder?: number; distanceFromPrevious?: number })[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [truck, setTruck] = useState<any | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [routeDisplayed, setRouteDisplayed] = useState(false);

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
        if (userObj.role === 'admin') {
          router.push('/admin');
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
    if (user) {
      fetchTruckAndSchedule();
    }
  }, [user]);

  useEffect(() => {
    if (showMap && mapContainer.current && !map.current) {
      initializeMap();
    }
    
    // Reset route displayed flag when map is hidden
    if (!showMap) {
      setRouteDisplayed(false);
    }
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [showMap]);

  useEffect(() => {
    if (activeRoute && routeBins.length > 0 && showMap) {
      // Reset route displayed flag when route data changes
      setRouteDisplayed(false);
      
      // Wait a bit for the map to be fully loaded before displaying route
      const timer = setTimeout(() => {
        if (map.current) {
          displayRouteOnMap();
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [activeRoute, routeBins, showMap]);

  const fetchTruckAndSchedule = async () => {
    if (!user) return;
    
    setScheduleLoading(true);
    try {
      // Fetch driver's truck
      const { data: truckData, error: truckError } = await supabase
        .from('trucks')
        .select('*')
        .eq('d_id', user.user_id)
        .single();

      if (truckError) {
        console.error('Error fetching truck:', truckError);
        return;
      }

      setTruck(truckData);

      // Fetch all data like the schedule page does
      const today = new Date().toISOString().split('T')[0];
      console.log('🔍 Fetching data for truck:', truckData.truck_id, 'on:', today);

      // Fetch all schedules for today
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .eq('scheduled_date', today);

      if (schedulesError) {
        console.error('Error fetching schedules:', schedulesError);
        return;
      }

      // Fetch all routes for today
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('*')
        .eq('scheduled_date', today);

      if (routesError) {
        console.error('Error fetching routes:', routesError);
        return;
      }

      // Fetch all assignments for today
      const { data: assignments, error: assignmentsError } = await supabase
        .from('truck_assignments')
        .select(`
          *,
          bins (*)
        `)
        .eq('scheduled_date', today);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        return;
      }

      console.log('📊 Fetched data:', {
        schedules: schedules?.length || 0,
        routes: routes?.length || 0,
        assignments: assignments?.length || 0
      });

      // Find active route for this driver's truck (same logic as schedule page)
      const driverRoutes = routes?.filter(route => route.truck_id === truckData.truck_id) || [];
      console.log('🚛 Routes for this truck:', driverRoutes);

      const activeRoute = driverRoutes.find(route => 
        route.status === 'pending' || route.status === 'in_progress'
      );

      if (activeRoute) {
        console.log('✅ Found active route:', activeRoute);
        setActiveRoute(activeRoute);

        // Find the schedule for this route
        const schedule = schedules?.find(s => s.schedule_id === activeRoute.schedule_id);
        if (schedule) {
          console.log('✅ Found schedule:', schedule);
          setActiveSchedule(schedule);
        }

        // Find assignments for this route
        const routeAssignments = assignments?.filter(assignment => 
          assignment.schedule_id === activeRoute.schedule_id && 
          assignment.truck_id === truckData.truck_id
        ) || [];

        console.log('📦 Assignments for this route:', routeAssignments.length);

        if (routeAssignments.length > 0) {
          // First, get all bins with their collection status
          const binsWithStatus = routeAssignments.map((assignment: any) => {
            // Check both database and local storage for collection status (same as schedule detail page)
            const dbCollected = assignment.status === 'collected';
            const dbCollectedAt = assignment.collected_at;
            
            // Check local storage for collection status
            const localCollections = typeof window !== 'undefined' ? 
              JSON.parse(localStorage.getItem('local_bin_collections') || '{}') : {};
            const scheduleKey = `${activeRoute.schedule_id}-${activeRoute.route_id}`;
            const localCollection = localCollections[scheduleKey]?.find((item: any) => item.plate === assignment.bins.bin_plate);
            
            const isCollected = dbCollected || !!localCollection;
            const collectedAt = dbCollectedAt || localCollection?.collectedAt;
            
            return {
              ...assignment.bins,
              isCollected,
              collectedAt
            };
          });
          
          // Apply optimal route order (same as schedule detail page)
          const orderedBins = calculateOptimalRoute(binsWithStatus);
          setRouteBins(orderedBins);
        }
      } else {
        console.log('❌ No active route found for this truck');
        setActiveRoute(null);
        setActiveSchedule(null);
        setRouteBins([]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleBinCollected = (plate: string) => {
    if (!activeSchedule?.schedule_id || !activeRoute?.route_id) {
      console.error('No active schedule or route found');
      return;
    }

    // Store collection in local storage (same as schedule detail page)
    const localCollections = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem('local_bin_collections') || '{}') : {};
    
    const scheduleKey = `${activeSchedule.schedule_id}-${activeRoute.route_id}`;
    if (!localCollections[scheduleKey]) {
      localCollections[scheduleKey] = [];
    }
    
    // Check if already collected
    const alreadyCollected = localCollections[scheduleKey].find((item: any) => item.plate === plate);
    if (alreadyCollected) {
      console.log(`⚠️ Bin ${plate} already collected locally`);
      return;
    }
    
    // Add to local storage
    localCollections[scheduleKey].push({
      plate,
      collectedAt: new Date().toISOString(),
      scheduleId: activeSchedule.schedule_id,
      routeId: activeRoute.route_id
    });
    
    localStorage.setItem('local_bin_collections', JSON.stringify(localCollections));
    console.log(`✅ Bin ${plate} marked as collected locally`);
    
    // Update local state to show bin as collected
    setRouteBins(prev => prev.map(bin => 
      bin.bin_plate === plate 
        ? { ...bin, isCollected: true, collectedAt: new Date().toISOString() }
        : bin
    ));
    
    // Check if all bins in the route are collected
    checkAndUpdateRouteCompletion();
  };

  const checkAndUpdateRouteCompletion = async () => {
    if (!activeSchedule?.schedule_id || !activeRoute?.route_id) return;
    
    const localCollections = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem('local_bin_collections') || '{}') : {};
    
    const scheduleKey = `${activeSchedule.schedule_id}-${activeRoute.route_id}`;
    const collectedPlates = localCollections[scheduleKey] || [];
    
    // Check if all bins in the route are collected
    const allBinsCollected = routeBins.every(bin => 
      collectedPlates.some((item: any) => item.plate === bin.bin_plate)
    );
    
    if (allBinsCollected && routeBins.length > 0) {
      console.log('🎉 All bins collected! Updating database...');
      
      try {
        // Update all bins in the database
        for (const bin of routeBins) {
          const response = await fetch('/api/bins/mark-collected', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              plate_number: bin.bin_plate,
              schedule_id: activeSchedule.schedule_id,
              route_id: activeRoute.route_id
            }),
          });
          
          const result = await response.json();
          if (!result.success) {
            console.error(`Failed to mark bin ${bin.bin_plate} as collected:`, result.error);
          }
        }
        
        console.log('✅ All bins updated in database');
        
        // Clear local storage for this route
        delete localCollections[scheduleKey];
        localStorage.setItem('local_bin_collections', JSON.stringify(localCollections));
        
        // Refresh schedule data to get updated status
        fetchTruckAndSchedule();
        
      } catch (error) {
        console.error('Error updating database:', error);
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate optimal route order using nearest neighbor algorithm (same as schedule detail page)
  const calculateOptimalRoute = (bins: Bin[]): (Bin & { collectionOrder: number; distanceFromPrevious?: number })[] => {
    if (bins.length === 0) return [];

    const unvisited = [...bins];
    const orderedBins: (Bin & { collectionOrder: number; distanceFromPrevious?: number })[] = [];
    let currentLocation = { lat: COLLECTION_CENTER.lat, lng: COLLECTION_CENTER.lng };

    // Start from collection center and find nearest bin
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = Number.MAX_VALUE;

      unvisited.forEach((bin, index) => {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          bin.latitude,
          bin.longitude
        );
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearestBin = unvisited[nearestIndex];
      orderedBins.push({
        ...nearestBin,
        collectionOrder: orderedBins.length + 1,
        distanceFromPrevious: shortestDistance
      });

      currentLocation = { lat: nearestBin.latitude, lng: nearestBin.longitude };
      unvisited.splice(nearestIndex, 1);
    }

    return orderedBins;
  };

  // Calculate distance between two points using Haversine formula (same as schedule detail page)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Initialize map (same as schedule detail page)
  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [COLLECTION_CENTER.lng, COLLECTION_CENTER.lat],
      zoom: 12
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Wait for map to be fully loaded before displaying route
    map.current.on('load', () => {
      console.log('Map loaded successfully');
      if (activeRoute && routeBins.length > 0) {
        // Small delay to ensure everything is ready
        setTimeout(() => {
          displayRouteOnMap();
        }, 1000);
      }
    });

    // Also listen for style load event
    map.current.on('styledata', () => {
      console.log('Map style loaded');
      if (activeRoute && routeBins.length > 0) {
        setTimeout(() => {
          displayRouteOnMap();
        }, 1000);
      }
    });

    // Listen for idle event as well
    map.current.on('idle', () => {
      console.log('Map is idle');
      if (activeRoute && routeBins.length > 0) {
        setTimeout(() => {
          displayRouteOnMap();
        }, 500);
      }
    });
  };

  // Display route on map (same as schedule detail page)
  const displayRouteOnMap = async () => {
    if (!map.current || !activeRoute || routeBins.length === 0) {
      console.log('displayRouteOnMap early return:', {
        mapExists: !!map.current,
        activeRoute: !!activeRoute,
        routeBinsLength: routeBins.length
      });
      return;
    }

    // Prevent multiple calls that cause blinking
    if (routeDisplayed) {
      console.log('Route already displayed, skipping');
      return;
    }
    
    const mapInstance = map.current; // Store reference to avoid null checks

    // Wait for map to be loaded before proceeding
    if (!mapInstance.isStyleLoaded()) {
      console.log('Waiting for map style to load...');
      mapInstance.once('idle', () => {
        displayRouteOnMap();
      });
      return;
    }

    console.log('Starting to display route on map with', routeBins.length, 'bins');

    // Clear existing layers and sources more carefully
    try {
      if (mapInstance.getLayer('route')) {
        mapInstance.removeLayer('route');
      }
      if (mapInstance.getSource('route')) {
        mapInstance.removeSource('route');
      }
    } catch (error) {
      console.log('Error clearing existing layers/sources:', error);
    }

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Create coordinates array starting from collection center
    const coordinates: [number, number][] = [];
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);
    
    routeBins.forEach(bin => {
      coordinates.push([bin.longitude, bin.latitude]);
    });
    
    coordinates.push([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat]);

    // Add collection center marker
    new mapboxgl.Marker({
      color: '#8b5cf6'
    })
      .setLngLat([COLLECTION_CENTER.lng, COLLECTION_CENTER.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${COLLECTION_CENTER.name}</h3>
              <p class="text-sm text-gray-600">Start/End Point</p>
              <p class="text-sm text-gray-600">Coordinates: ${COLLECTION_CENTER.lat.toFixed(4)}, ${COLLECTION_CENTER.lng.toFixed(4)}</p>
            </div>
          `)
      )
      .addTo(mapInstance);

    // Add numbered markers for each bin in collection order
    routeBins.forEach((bin) => {
      // Create custom marker with number
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.backgroundColor = bin.isCollected ? '#10b981' : 
                                activeRoute.status === 'in_progress' ? '#f59e0b' : '#3b82f6';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '12px';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      el.textContent = bin.collectionOrder?.toString() || '';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([bin.longitude, bin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-3">
                <h3 class="font-semibold">${bin.label || bin.bin_plate}</h3>
                <p class="text-sm text-gray-600"><strong>Collection Order:</strong> ${bin.collectionOrder} of ${routeBins.length}</p>
                <p class="text-sm text-gray-600"><strong>Area:</strong> ${bin.area}</p>
                <p class="text-sm text-gray-600"><strong>Status:</strong> ${bin.isCollected ? 'Collected' : 'Pending'}</p>
                ${bin.distanceFromPrevious ? 
                  `<p class="text-sm text-gray-600"><strong>Distance from previous:</strong> ${bin.distanceFromPrevious.toFixed(2)} km</p>` : ''
                }
                <p class="text-sm text-gray-600"><strong>Coordinates:</strong> ${bin.latitude.toFixed(4)}, ${bin.longitude.toFixed(4)}</p>
              </div>
            `)
        )
        .addTo(mapInstance);
    });

    // Fit map to show all markers first
    if (coordinates.length > 0 && mapInstance) {
      try {
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        mapInstance.fitBounds(bounds, {
          padding: 50
        });
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }

    // Then add the route line
    if (coordinates.length > 2) {
      try {
        const coordinatesString = coordinates.map(coord => coord.join(',')).join(';');
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&steps=true&access_token=${mapboxgl.accessToken}`;
        
        console.log('Fetching route from:', directionsUrl);
        const response = await fetch(directionsUrl);
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          console.log('Route data received:', route);
          
          // Add route line to map with status-based color
          const routeColor = activeRoute.status === 'completed' ? '#10b981' : 
                           activeRoute.status === 'in_progress' ? '#f59e0b' : '#3b82f6';

          // Double-check that map is ready and source doesn't exist before adding
          if (mapInstance && mapInstance.isStyleLoaded() && !mapInstance.getSource('route')) {
            try {
              mapInstance.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: route.geometry
                }
              });

              mapInstance.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': routeColor,
                  'line-width': 5,
                  'line-opacity': 0.8
                }
              });
              
              console.log('Route line added successfully');
              setRouteDisplayed(true); // Mark route as displayed
            } catch (mapError) {
              console.error('Error adding route to map:', mapError);
            }
          } else {
            console.warn('Map not ready or route source already exists, skipping route display');
          }
        } else {
          console.error('No route data received from Mapbox API');
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    }
  };

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
    <div className="p-6">
      <PageBreadcrumb pageTitle="Camera Scanner" />
      
      {/* Map Section - Full width, main focus */}
      {activeRoute && routeBins.length > 0 && (
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Route Map
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {routeBins.filter(bin => bin.isCollected).length} of {routeBins.length} bins collected
                </span>
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  {showMap ? 'Hide Map' : 'Show Map'}
                </button>
              </div>
            </div>
            
            {showMap && (
              <div 
                ref={mapContainer} 
                className="w-full h-96 rounded-lg border border-gray-200 dark:border-gray-600"
                style={{ minHeight: '384px' }}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Section - Takes up 2/3 of the space */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Bin Collection Scanner
            </h2>
            <CameraViewer
              scheduleId={activeSchedule?.schedule_id?.toString()}
              routeId={activeRoute?.route_id}
              isCollectionMode={true}
              autoDetectSchedule={false}
              onBinCollected={handleBinCollected}
            />
          </div>
        </div>

        {/* Schedule Sidebar - Takes up 1/3 of the space */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              Current Schedule
            </h2>
            
            {/* Debug Info - Only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Debug Info</h3>
                <div className="text-xs text-yellow-700 space-y-1">
                  <p><strong>User ID:</strong> {user?.user_id}</p>
                  <p><strong>Truck ID:</strong> {truck?.truck_id}</p>
                  <p><strong>Truck Plate:</strong> {truck?.plate_no}</p>
                  <p><strong>Today:</strong> {new Date().toISOString().split('T')[0]}</p>
                </div>
              </div>
            )}
            
            {scheduleLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading schedule...</span>
              </div>
            ) : activeSchedule ? (
              <div className="space-y-4">
                {/* Schedule Info */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                    {activeSchedule.schedule_name}
                  </h3>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    {new Date(activeSchedule.scheduled_date).toLocaleDateString()}
                  </p>
                  <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium mt-2 ${getStatusColor(activeSchedule.status)}`}>
                    {activeSchedule.status}
                  </div>
                </div>

                {/* Route Info */}
                {activeRoute && (
                  <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-200">
                      {activeRoute.route_name}
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      Truck: {truck?.plate_no}
                    </p>
                    <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium mt-2 ${getStatusColor(activeRoute.status)}`}>
                      {activeRoute.status}
                    </div>
                  </div>
                )}

                {/* Bin Progress */}
                {routeBins.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-3">
                      Bin Collection Progress
                    </h4>
                    <div className="space-y-2">
                      {routeBins.map((bin) => (
                        <div
                          key={bin.bin_id}
                          className={`p-3 rounded-lg border-l-4 ${
                            bin.isCollected
                              ? 'border-l-green-500 bg-green-50 dark:bg-green-900'
                              : 'border-l-blue-500 bg-blue-50 dark:bg-blue-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {bin.label || bin.bin_plate}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {bin.area}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {bin.isCollected ? (
                                <div className="text-green-600 dark:text-green-400">
                                  ✓ Collected
                                </div>
                              ) : (
                                <div className="text-blue-600 dark:text-blue-400">
                                  {bin.collectionOrder}
                                </div>
                              )}
                            </div>
                          </div>
                          {bin.isCollected && bin.collectedAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Collected at {formatTime(bin.collectedAt)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Progress Summary */}
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm">
                          {routeBins.filter(bin => bin.isCollected).length} / {routeBins.length}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(routeBins.filter(bin => bin.isCollected).length / routeBins.length) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* No bins message */}
                {routeBins.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No bins assigned to this route</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No active route found for today</p>
                <p className="text-sm mt-2">This could mean:</p>
                <ul className="text-sm text-left max-w-xs mx-auto mt-2 space-y-1">
                  <li>• No route was assigned to your truck for today</li>
                  <li>• Your route status is not 'pending' or 'in_progress'</li>
                  <li>• You need to start your route from the schedule page</li>
                </ul>
                <button
                  onClick={() => router.push('/driver/schedule')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View My Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 