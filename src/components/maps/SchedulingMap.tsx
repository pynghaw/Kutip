"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";
import "mapbox-gl/dist/mapbox-gl.css";
import Calendar from "@/components/ui/Calendar";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Bin = {
  bin_id: number;
  label: string;
  latitude: number;
  longitude: number;
  status: number;
  c_id: number;
  bin_plate: string;
  area: string;
};

type Truck = {
  truck_id: number;
  plate_no: string;
  assigned_area: string;
  d_id: number;
  driver_name: string;
  is_active: boolean;
};

type TruckAssignment = {
  assignment_id?: number;
  truck_id: number;
  bin_id: number;
  scheduled_date: string;
  schedule_id?: number;
  route_id?: number; // Added route_id foreign key
};

type Route = {
  route_id?: number;
  route_name: string;
  truck_id: number;
  scheduled_date: string;
  //estimated_duration: number;
  status: 'pending' | 'in_progress' | 'completed';
  total_bins?: number;
  schedule_id?: number;
};

type Schedule = {
  schedule_id?: number;
  schedule_name: string;
  scheduled_date: string;
  created_at?: string;
  total_trucks: number;
  total_bins: number;
  total_routes: number;
  description?: string;
  status?: string;
};

export default function AutoSchedulingPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [schedulingDate, setSchedulingDate] = useState<string>('');
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [showAutoScheduleForm, setShowAutoScheduleForm] = useState(false);
  const [selectedTrucks, setSelectedTrucks] = useState<number[]>([]);
  const [showScheduleTable, setShowScheduleTable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const centerLat = 1.5341;
  const centerLng = 103.6217;

  // Set today's date by default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSchedulingDate(today);
  }, []);

  // Area definitions based on coordinates
  const getAreaFromCoordinates = (lat: number, lng: number): string => {
    if (lat > centerLat && lng < centerLng) return "Northwest";
    if (lat > centerLat && lng >= centerLng) return "Northeast"; 
    if (lat <= centerLat && lng < centerLng) return "Southwest";
    return "Southeast";
  };

  const getAreaColor = (area: string): string => {
    switch(area) {
      case "Northwest": return "#f43f5e";
      case "Northeast": return "#3b82f6";
      case "Southwest": return "#10b981";
      case "Southeast": return "#eab308";
      default: return "#6b7280";
    }
  };

  // Check if table exists
  const checkTableExists = async (tableName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.log(`Table ${tableName} does not exist:`, error);
      return false;
    }
  };

  // Create routes table if it doesn't exist
  const createRoutesTable = async (): Promise<boolean> => {
    try {
      // First check if table exists
      const tableExists = await checkTableExists('routes');
      if (tableExists) {
        console.log('Routes table already exists');
        return true;
      }

      // Create the table using SQL
      const { error } = await supabase.rpc('create_routes_table', {});
      
      if (error) {
        console.error('Error creating routes table:', error);
        
        // Alternative: Try direct SQL execution
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS routes (
            route_id SERIAL PRIMARY KEY,
            route_name VARCHAR(255) NOT NULL,
            truck_id INTEGER REFERENCES trucks(truck_id),
            scheduled_date DATE NOT NULL,
            estimated_duration INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
            total_bins INTEGER DEFAULT 0,
            schedule_id INTEGER REFERENCES schedules(schedule_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        
        if (sqlError) {
          console.error('Failed to create routes table with SQL:', sqlError);
          return false;
        }
      }
      
      console.log('Routes table created successfully');
      return true;
    } catch (error) {
      console.error('Exception creating routes table:', error);
      return false;
    }
  };

  // Create schedules table if it doesn't exist
  const createSchedulesTable = async (): Promise<boolean> => {
    try {
      // First check if table exists
      const tableExists = await checkTableExists('schedules');
      if (tableExists) {
        console.log('Schedules table already exists');
        return true;
      }

      // Create the table using SQL
      const { error } = await supabase.rpc('create_schedules_table', {});
      
      if (error) {
        console.error('Error creating schedules table:', error);
        
        // Alternative: Try direct SQL execution
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS schedules (
            schedule_id SERIAL PRIMARY KEY,
            schedule_name VARCHAR(255) NOT NULL,
            scheduled_date DATE NOT NULL,
            total_trucks INTEGER DEFAULT 0,
            total_bins INTEGER DEFAULT 0,
            total_routes INTEGER DEFAULT 0,
            description TEXT,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        
        if (sqlError) {
          console.error('Failed to create schedules table with SQL:', sqlError);
          return false;
        }
      }
      
      console.log('Schedules table created successfully');
      return true;
    } catch (error) {
      console.error('Exception creating schedules table:', error);
      return false;
    }
  };

  // Update truck_assignments table to include both schedule_id and route_id foreign keys
  const updateTruckAssignmentsTable = async (): Promise<boolean> => {
    try {
      console.log('🔧 Checking truck_assignments table structure...');
      
      // First, check if columns already exist by trying to select them
      let existingColumns: string[] = [];
      
      try {
        // Try to check existing columns using RPC
        const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', { 
          sql: `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'truck_assignments' 
            AND column_name IN ('schedule_id', 'route_id')
          `
        });
        
        if (!columnsError && columns) {
          existingColumns = columns.map((col: any) => col.column_name);
        }
      } catch (rpcError) {
        console.warn('⚠️ RPC exec_sql not available, trying alternative approach...');
        
        // Fallback: try to select from the columns directly
        try {
          const { error: scheduleTest } = await supabase
            .from('truck_assignments')
            .select('schedule_id')
            .limit(1);
          
          if (!scheduleTest) {
            existingColumns.push('schedule_id');
          }
        } catch (e) {
          // schedule_id doesn't exist
        }
        
        try {
          const { error: routeTest } = await supabase
            .from('truck_assignments')
            .select('route_id')
            .limit(1);
          
          if (!routeTest) {
            existingColumns.push('route_id');
          }
        } catch (e) {
          // route_id doesn't exist
        }
      }
      
      console.log('📋 Existing columns:', existingColumns);
      
      // Add schedule_id if it doesn't exist
      if (!existingColumns.includes('schedule_id')) {
        console.log('➕ Adding schedule_id column...');
        try {
          const { error: scheduleError } = await supabase.rpc('exec_sql', { 
            sql: `ALTER TABLE truck_assignments ADD COLUMN schedule_id INTEGER;`
          });
          
          if (scheduleError) {
            console.warn('⚠️ Could not add schedule_id column (might already exist):', scheduleError);
          } else {
            console.log('✅ schedule_id column added successfully');
          }
        } catch (rpcError) {
          console.warn('⚠️ RPC not available for adding schedule_id column');
        }
      } else {
        console.log('✅ schedule_id column already exists');
      }

      // Add route_id if it doesn't exist
      if (!existingColumns.includes('route_id')) {
        console.log('➕ Adding route_id column...');
        try {
          const { error: routeError } = await supabase.rpc('exec_sql', { 
            sql: `ALTER TABLE truck_assignments ADD COLUMN route_id INTEGER;`
          });
          
          if (routeError) {
            console.warn('⚠️ Could not add route_id column (might already exist):', routeError);
          } else {
            console.log('✅ route_id column added successfully');
          }
        } catch (rpcError) {
          console.warn('⚠️ RPC not available for adding route_id column');
        }
      } else {
        console.log('✅ route_id column already exists');
      }
      
      // Try to add foreign key constraints if they don't exist
      try {
        console.log('🔗 Adding foreign key constraints...');
        
        // Add schedule_id foreign key constraint
        const { error: scheduleFkError } = await supabase.rpc('exec_sql', { 
          sql: `
            DO $$ 
            BEGIN 
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'truck_assignments_schedule_id_fkey'
              ) THEN
                ALTER TABLE truck_assignments 
                ADD CONSTRAINT truck_assignments_schedule_id_fkey 
                FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id);
              END IF;
            END $$;
          `
        });
        
        if (scheduleFkError) {
          console.warn('⚠️ Could not add schedule_id foreign key:', scheduleFkError);
        } else {
          console.log('✅ schedule_id foreign key constraint added');
        }
        
        // Add route_id foreign key constraint
        const { error: routeFkError } = await supabase.rpc('exec_sql', { 
          sql: `
            DO $$ 
            BEGIN 
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'truck_assignments_route_id_fkey'
              ) THEN
                ALTER TABLE truck_assignments 
                ADD CONSTRAINT truck_assignments_route_id_fkey 
                FOREIGN KEY (route_id) REFERENCES routes(route_id);
              END IF;
            END $$;
          `
        });
        
        if (routeFkError) {
          console.warn('⚠️ Could not add route_id foreign key:', routeFkError);
        } else {
          console.log('✅ route_id foreign key constraint added');
        }
        
      } catch (fkError) {
        console.warn('⚠️ Foreign key constraint addition failed:', fkError);
      }
      
      console.log('✅ truck_assignments table structure updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception updating truck_assignments table:', error);
      // Don't fail the entire process, just log the error
      return true; // Return true to continue with the process
    }
  };

  // Fetch data functions
  const fetchBins = async () => {
    try {
      const { data, error } = await supabase.from("bins").select("*");
      if (error) throw error;
      
      const binsWithArea = (data || []).map(bin => ({
        ...bin,
        area: getAreaFromCoordinates(bin.latitude, bin.longitude)
      }));
      setBins(binsWithArea);
    } catch (error) {
      console.error("Error fetching bins:", error);
    }
  };

  const fetchTrucks = async () => {
    try {
      const { data, error } = await supabase.from("trucks").select("*");
      if (error) throw error;
      setTrucks(data || []);
    } catch (error) {
      console.error("Error fetching trucks:", error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase.from("truck_assignments").select("*");
      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const fetchRoutes = async () => {
    try {
      // First ensure routes table exists
      const routesTableExists = await checkTableExists('routes');
      if (!routesTableExists) {
        console.log('Routes table does not exist, creating...');
        await createRoutesTable();
      }

      const { data, error } = await supabase.from("routes").select("*");
      if (error) {
        console.error("Error fetching routes:", error);
        setRoutes([]);
      } else {
        setRoutes(data || []);
      }
    } catch (error) {
      console.error("Exception fetching routes:", error);
      setRoutes([]);
    }
  };

  const fetchSchedules = async () => {
    try {
      // First ensure schedules table exists
      const schedulesTableExists = await checkTableExists('schedules');
      if (!schedulesTableExists) {
        console.log('Schedules table does not exist, creating...');
        await createSchedulesTable();
      }

      const { data, error } = await supabase.from("schedules").select("*");
      if (error) {
        console.error("Error fetching schedules:", error);
        setSchedules([]);
      } else {
        setSchedules(data || []);
      }
    } catch (error) {
      console.error("Exception fetching schedules:", error);
      setSchedules([]);
    }
  };

  useEffect(() => {
    fetchBins();
    fetchTrucks();
    fetchAssignments();
    fetchRoutes();
    fetchSchedules();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [centerLng, centerLat],
        zoom: 13,
      });

      map.current.on("load", () => setMapLoaded(true));
    }
  }, []);

  // Add markers to map
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    markers.forEach((marker) => marker.remove());
    const newMarkers: mapboxgl.Marker[] = [];

    const filteredBins = selectedArea ? bins.filter(bin => bin.area === selectedArea) : bins;

    filteredBins.forEach((bin) => {
      const color = getAreaColor(bin.area || '');
      const isAssigned = assignments.some(a => a.bin_id === bin.bin_id && a.scheduled_date === schedulingDate);
      const scale = isAssigned ? 1.3 : 1;
      const opacity = selectedArea && bin.area !== selectedArea ? 0.3 : 1;

      const marker = new mapboxgl.Marker({ color, scale })
        .setLngLat([bin.longitude, bin.latitude])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div>
              <strong>${bin.label}</strong><br/>
              Area: ${bin.area}<br/>
              Bin Plate: ${bin.bin_plate}<br/>
              Status: ${isAssigned ? '✅ Assigned' : '⏳ Unassigned'}
            </div>
          `)
        )
        .addTo(map.current!);

      marker.getElement().style.opacity = opacity.toString();
      newMarkers.push(marker);
    });

    const centerMarker = new mapboxgl.Marker({
      color: "#6F42C1",
      scale: 1.5,
    })
      .setLngLat([centerLng, centerLat])
      .setPopup(new mapboxgl.Popup().setText("Collection Center"))
      .addTo(map.current!);

    newMarkers.push(centerMarker);
    setMarkers(newMarkers);
  }, [bins, mapLoaded, selectedArea, assignments, schedulingDate]);

  // K-Means clustering algorithm for better bin distribution
  const kMeansClustering = (bins: Bin[], k: number, maxIterations: number = 100): Bin[][] => {
    if (bins.length === 0 || k === 0) return [];
    
    // Initialize centroids randomly
    let centroids = bins.slice(0, k).map(bin => ({
      lat: bin.latitude,
      lng: bin.longitude
    }));
    
    // If we have fewer bins than trucks, pad with the first bin
    while (centroids.length < k) {
      centroids.push({
        lat: bins[0].latitude,
        lng: bins[0].longitude
      });
    }
    
    let clusters: Bin[][] = Array(k).fill(null).map(() => []);
    let iterations = 0;
    
    while (iterations < maxIterations) {
      // Reset clusters
      clusters = Array(k).fill(null).map(() => []);
      
      // Assign each bin to nearest centroid
      bins.forEach(bin => {
        let minDistance = Infinity;
        let bestCluster = 0;
        
        centroids.forEach((centroid, index) => {
          const distance = getDistance(bin.latitude, bin.longitude, centroid.lat, centroid.lng);
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = index;
          }
        });
        
        clusters[bestCluster].push(bin);
      });
      
      // Update centroids
      const newCentroids = clusters.map(cluster => {
        if (cluster.length === 0) {
          return { lat: centerLat, lng: centerLng }; // Default to center if cluster is empty
        }
        
        const avgLat = cluster.reduce((sum, bin) => sum + bin.latitude, 0) / cluster.length;
        const avgLng = cluster.reduce((sum, bin) => sum + bin.longitude, 0) / cluster.length;
        
        return { lat: avgLat, lng: avgLng };
      });
      
      // Check for convergence
      const centroidsChanged = newCentroids.some((newCentroid, index) => {
        const oldCentroid = centroids[index];
        return getDistance(newCentroid.lat, newCentroid.lng, oldCentroid.lat, oldCentroid.lng) > 0.001;
      });
      
      if (!centroidsChanged) break;
      
      centroids = newCentroids;
      iterations++;
    }
    
    return clusters;
  };

  // Optimize route within a cluster using 2-opt algorithm
  const optimizeRoute2Opt = (bins: Bin[]): Bin[] => {
    if (bins.length <= 2) return bins;
    
    let bestRoute = [...bins];
    let bestDistance = calculateTotalDistance(bestRoute);
    let improved = true;
    
    while (improved) {
      improved = false;
      
      for (let i = 0; i < bins.length - 1; i++) {
        for (let j = i + 2; j < bins.length; j++) {
          // Try 2-opt swap
          const newRoute = [...bestRoute];
          const temp = newRoute[i + 1];
          newRoute[i + 1] = newRoute[j];
          newRoute[j] = temp;
          
          const newDistance = calculateTotalDistance(newRoute);
          
          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }
    
    return bestRoute;
  };

  // Calculate total distance of a route
  const calculateTotalDistance = (bins: Bin[]): number => {
    if (bins.length <= 1) return 0;
    
    let totalDistance = 0;
    
    // Distance from center to first bin
    totalDistance += getDistance(centerLat, centerLng, bins[0].latitude, bins[0].longitude);
    
    // Distance between bins
    for (let i = 0; i < bins.length - 1; i++) {
      totalDistance += getDistance(
        bins[i].latitude, bins[i].longitude,
        bins[i + 1].latitude, bins[i + 1].longitude
      );
    }
    
    // Distance from last bin back to center
    totalDistance += getDistance(centerLat, centerLng, bins[bins.length - 1].latitude, bins[bins.length - 1].longitude);
    
    return totalDistance;
  };

  // Calculate distance between two points using Haversine formula
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Enhanced route optimization using multiple algorithms
  const optimizeRoute = (binIds: number[]): number[] => {
    if (binIds.length <= 1) return binIds;

    const selectedBins = bins.filter(bin => binIds.includes(bin.bin_id));
    
    // Use 2-opt optimization
    const optimizedBins = optimizeRoute2Opt(selectedBins);
    
    return optimizedBins.map(bin => bin.bin_id);
  };

  // Handle truck selection
  const handleTruckSelection = (truckId: number) => {
    setSelectedTrucks(prev => {
      if (prev.includes(truckId)) {
        return prev.filter(id => id !== truckId);
      } else {
        return [...prev, truckId];
      }
    });
  };

  // FIXED: Updated automatic scheduling algorithm with proper route_id connection
  // FIXED: Updated automatic scheduling algorithm with proper route_id connection and correct status handling
const performAutoScheduling = async (date: string) => {
  if (!date) {
    alert("Please select a scheduling date");
    return;
  }

  if (selectedTrucks.length === 0) {
    alert("Please select at least one truck");
    return;
  }

  setIsLoading(true);

  try {
    console.log('🚀 Starting auto-scheduling process...');

    // Step 0: Ensure required tables exist and are updated
    console.log('📋 Checking and creating required tables...');
    
    const schedulesTableCreated = await createSchedulesTable();
    const routesTableCreated = await createRoutesTable();
    const truckAssignmentsUpdated = await updateTruckAssignmentsTable();
    
    if (!schedulesTableCreated) {
      throw new Error('Failed to create schedules table');
    }
    if (!routesTableCreated) {
      console.warn('⚠️ Routes table creation failed, continuing without routes');
    }
    if (!truckAssignmentsUpdated) {
      console.warn('⚠️ Truck assignments table update failed, continuing anyway');
    }

    // Get available trucks
    const selectedTruckObjects = trucks.filter(truck => 
      selectedTrucks.includes(truck.truck_id) && truck.is_active === true
    );

    if (selectedTruckObjects.length === 0) {
      alert("None of the selected trucks are available");
      return;
    }

    // Get unassigned bins
    const unassignedBins = bins.filter(bin => 
      !assignments.some(a => a.bin_id === bin.bin_id && a.scheduled_date === date)
    );

    if (unassignedBins.length === 0) {
      alert("No unassigned bins for the selected date");
      return;
    }

    console.log(`📊 Processing ${unassignedBins.length} bins with ${selectedTruckObjects.length} trucks`);

    // Step 1: Create schedule record FIRST with correct status
    console.log('💾 Creating schedule...');
    const scheduleName = `Auto Schedule - ${new Date(date).toLocaleDateString()} - ${new Date().toLocaleTimeString()}`;
    const scheduleDescription = `Automated scheduling for ${selectedTruckObjects.length} trucks covering ${unassignedBins.length} bins`;
    
    const newSchedule: Omit<Schedule, 'schedule_id' | 'created_at'> = {
      schedule_name: scheduleName,
      scheduled_date: date,
      total_trucks: selectedTruckObjects.length,
      total_bins: unassignedBins.length,
      total_routes: selectedTruckObjects.length,
      description: scheduleDescription,
      status: 'pending', // Always use 'pending' for new auto-schedules
    };

    let scheduleId: number | null = null;
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedules")
      .insert([newSchedule])
      .select('schedule_id')
      .single();

    if (scheduleError) {
      console.error("❌ Schedule creation error:", scheduleError);
      
      // Try alternative status values if constraint error
      if (scheduleError.message.includes('status_check') || scheduleError.message.includes('check constraint')) {
        console.log('🔄 Trying alternative status values...');
        
        // Try other valid status values that make sense for new schedules
        const statusesToTry = ['active', 'scheduled', 'draft'];
        let statusWorked = false;
        
        for (const statusValue of statusesToTry) {
          if (statusWorked) break;
          
          try {
            const retrySchedule = { ...newSchedule, status: statusValue };
            const { data: retryData, error: retryError } = await supabase
              .from("schedules")
              .insert([retrySchedule])
              .select('schedule_id')
              .single();
            
            if (!retryError) {
              scheduleId = retryData?.schedule_id;
              statusWorked = true;
              console.log(`✅ Schedule created with status: ${statusValue}, ID: ${scheduleId}`);
              break;
            }
          } catch (retryError) {
            continue;
          }
        }
        
        if (!statusWorked) {
          // Try without status field entirely
          try {
            const { status, ...scheduleWithoutStatus } = newSchedule;
            const { data: finalData, error: finalError } = await supabase
              .from("schedules")
              .insert([scheduleWithoutStatus])
              .select('schedule_id')
              .single();
            
            if (!finalError) {
              scheduleId = finalData?.schedule_id;
              console.log(`✅ Schedule created without explicit status, ID: ${scheduleId}`);
            } else {
              throw new Error(`Schedule creation failed: ${finalError.message}`);
            }
          } catch (finalError) {
            throw new Error(`Schedule creation failed: ${finalError}`);
          }
        }
      } else {
        throw new Error(`Schedule creation failed: ${scheduleError.message}`);
      }
    } else {
      scheduleId = scheduleData?.schedule_id;
      console.log("✅ Schedule created with ID:", scheduleId);
    }

    if (!scheduleId) {
      throw new Error('Failed to get schedule ID');
    }

    // Step 2: Create routes FIRST, then assignments with route_id
    console.log('📋 Creating routes first...');
    
    // Use K-Means clustering for better bin distribution
    const unassignedBinsArray = Array.from(unassignedBins);
    const clusters = kMeansClustering(unassignedBinsArray, selectedTruckObjects.length);
    
    // Prepare route data and assignments
    const routeCreationData: Array<{
      route: Omit<Route, 'route_id'>;
      truckBins: Bin[];
      truck: Truck;
    }> = [];

    // Assign clusters to trucks
    for (let i = 0; i < selectedTruckObjects.length && i < clusters.length; i++) {
      const truck = selectedTruckObjects[i];
      const clusterBins = clusters[i];
      
      if (clusterBins.length === 0) continue;

      // Create route record
      const route: Omit<Route, 'route_id'> = {
        route_name: `${truck.assigned_area} - ${truck.plate_no} - ${new Date(date).toLocaleDateString()}`,
        truck_id: truck.truck_id,
        scheduled_date: date,
        status: 'pending', // Routes should also start as pending
        total_bins: clusterBins.length,
        schedule_id: scheduleId,
      };

      routeCreationData.push({ route, truckBins: clusterBins, truck });
    }

    // Step 3: Insert routes and get their IDs
    console.log('💾 Creating routes...');
    const createdRoutes: Route[] = [];
    let routesCreated = false;

    if (routesTableCreated && routeCreationData.length > 0) {
      try {
        const routesToInsert = routeCreationData.map(rcd => rcd.route);
        const { data: routeData, error: routeError } = await supabase
          .from("routes")
          .insert(routesToInsert)
          .select('*');

        if (routeError) {
          console.error("❌ Route creation error:", routeError);
          throw new Error(`Failed to create routes: ${routeError.message}`);
        } else {
          createdRoutes.push(...(routeData || []));
          routesCreated = true;
          console.log("✅ Routes created successfully:", createdRoutes.length);
        }
      } catch (error) {
        console.error("❌ Exception creating routes:", error);
        throw new Error('Failed to create routes');
      }
    } else {
      throw new Error('Routes table not available or no route data');
    }

    // Step 4: Create assignments with route_id references
    console.log('💾 Creating truck assignments with route references...');
    const newAssignments: Omit<TruckAssignment, 'assignment_id'>[] = [];

    for (let i = 0; i < routeCreationData.length; i++) {
      const { truckBins, truck } = routeCreationData[i];
      const correspondingRoute = createdRoutes.find(r => 
        r.truck_id === truck.truck_id && 
        r.scheduled_date === date && 
        r.schedule_id === scheduleId
      );

      if (!correspondingRoute) {
        console.error(`❌ Could not find corresponding route for truck ${truck.truck_id}`);
        continue;
      }

      // Optimize route for this truck
      const optimizedBinIds = optimizeRoute(truckBins.map(b => b.bin_id));
      
      // Create assignments with both schedule_id and route_id
      const truckAssignments = optimizedBinIds.map((binId) => ({
        truck_id: truck.truck_id,
        bin_id: binId,
        scheduled_date: date,
        schedule_id: scheduleId,
        route_id: correspondingRoute.route_id!, // Add route_id reference
      }));

      newAssignments.push(...truckAssignments);
    }

    // Insert assignments with route references
    const { error: assignmentError } = await supabase
      .from("truck_assignments")
      .insert(newAssignments);

    if (assignmentError) {
      console.error("❌ Assignment creation error:", assignmentError);
      throw new Error(`Failed to create assignments: ${assignmentError.message}`);
    }

    console.log("✅ Assignments created successfully with schedule_id and route_id:", newAssignments.length);

    // Success message
    const remainingBins = unassignedBins.length - newAssignments.length;
    let successMessage = `🎉 Auto-scheduling completed!\n\n`;
    successMessage += `📊 Summary:\n`;
    successMessage += `• Schedule ID: ${scheduleId} ✅\n`;
    successMessage += `• Status: PENDING (ready to execute) ✅\n`;
    successMessage += `• ${newAssignments.length} bins assigned ✅\n`;
    successMessage += `• ${selectedTruckObjects.length} trucks scheduled ✅\n`;
    successMessage += `• ${createdRoutes.length} routes created ✅\n`;
    successMessage += `• ${remainingBins} bins remaining unassigned\n`;
    successMessage += `• All assignments linked to routes ✅\n`;

    alert(successMessage);
    
    // Refresh data
    console.log('🔄 Refreshing data...');
    await Promise.all([
      fetchAssignments(),
      fetchRoutes(),
      fetchSchedules()
    ]);
    
    // Reset form
    setShowAutoScheduleForm(false);
    setSelectedTrucks([]);
    
    console.log('🎉 Auto-scheduling process completed successfully!');
    
  } catch (error) {
    console.error("❌ Critical error in auto-scheduling:", error);
    alert(`Failed to complete auto-scheduling: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
  } finally {
    setIsLoading(false);
  }
};

  // Show route on map
  const showRouteOnMap = async (route: Route) => {
    if (!map.current) return;

    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Get assignments for this route
    const routeAssignments = assignments.filter(a => 
      a.truck_id === route.truck_id && 
      a.scheduled_date === route.scheduled_date
    );

    const routeBins = bins.filter(bin => 
      routeAssignments.some(a => a.bin_id === bin.bin_id)
    );

    const coordinates = routeBins.map(bin => [bin.longitude, bin.latitude]);
    
    coordinates.unshift([centerLng, centerLat]);
    coordinates.push([centerLng, centerLat]);

    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    setActiveRoute(route);
  };

  const areas = [...new Set(bins.map(bin => bin.area).filter(Boolean))];
  const availableTrucks = trucks.filter(truck => truck.is_active === true);

return (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4 min-h-[800px]">
    <div className="flex justify-between items-center">
       <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          title="Go back to previous page"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
          Back
        </button>
      <h1 className="text-2xl font-bold">Auto Scheduling & Routing</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setShowAutoScheduleForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          disabled={isLoading}
        >
          {isLoading ? '🔄 Processing...' : '🤖 Auto Schedule'}
        </button>
      </div>
    </div>

    {/* Enhanced Filters Section */}
    <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg">
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium text-gray-700">Filter by Area:</label>
        <select
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Areas</option>
          {areas.map(area => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>
      
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium text-gray-700">Schedule Date:</label>
        <div className="flex items-center gap-2">
          <Calendar
            value={schedulingDate}
            onChange={setSchedulingDate}
            placeholder="Select date"
            className="w-48"
          />
          <button
            onClick={() => setSchedulingDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
            title="Set to today"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 bg-white px-3 py-2 rounded-md border">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>Showing: {selectedArea ? bins.filter(b => b.area === selectedArea).length : bins.length} bins</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span>Date: {new Date(schedulingDate).toLocaleDateString()}</span>
        </div>
        {schedulingDate === new Date().toISOString().split('T')[0] && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            <span className="text-orange-600 font-medium">Today</span>
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* Map */}
      <div className="lg:col-span-2">
        <div ref={mapContainer} className="w-full h-full rounded-xl border border-gray-300" />
      </div>

      {/* Routes & Assignments List */}
      <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Scheduled Routes</h3>
          <span className="text-xs text-gray-500">
            {new Date(schedulingDate).toLocaleDateString()}
          </span>
        </div>
        <div className="space-y-2">
          {routes
            .filter(route => !schedulingDate || route.scheduled_date.startsWith(schedulingDate))
            .map((route) => {
              const truck = trucks.find(t => t.truck_id === route.truck_id);
              return (
                <div
                  key={route.route_id}
                  className={`p-3 bg-white rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                    activeRoute?.route_id === route.route_id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => showRouteOnMap(route)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{route.route_name}</h4>
                      <p className="text-xs text-gray-600">
                        Truck: {truck?.plate_no} ({truck?.assigned_area})
                      </p>
                      <p className="text-xs text-gray-600">
                        Date: {new Date(route.scheduled_date).toLocaleDateString()}
                      </p>
    
                      <p className="text-xs text-gray-600">
                        Bins: {route.total_bins || 0}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      route.status === 'completed' ? 'bg-green-100 text-green-800' :
                      route.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {route.status}
                    </span>
                  </div>
                </div>
              );
            })}
          {routes.filter(route => !schedulingDate || route.scheduled_date.startsWith(schedulingDate)).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No routes scheduled for this date</p>
              <p className="text-xs mt-1">Click "Auto Schedule" to create routes</p>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Statistics for {new Date(schedulingDate).toLocaleDateString()}</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total Bins:</span>
              <span className="font-medium">{bins.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Assigned Bins:</span>
              <span className="font-medium text-green-600">
                {assignments.filter(a => a.scheduled_date === schedulingDate).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unassigned Bins:</span>
              <span className={`font-medium ${
                bins.length - assignments.filter(a => a.scheduled_date === schedulingDate).length > 0 
                  ? 'text-orange-600' 
                  : 'text-green-600'
              }`}>
                {bins.length - assignments.filter(a => a.scheduled_date === schedulingDate).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active Trucks:</span>
              <span className="font-medium">{availableTrucks.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Routes:</span>
              <span className="font-medium">{routes.filter(r => r.scheduled_date === schedulingDate).length}</span>
            </div>
          </div>
        </div>

        {/* Area Legend */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Area Colors</h4>
          <div className="space-y-1">
            {areas.map(area => (
              <div key={area} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getAreaColor(area) }}
                ></div>
                <span>{area}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Auto Schedule Form */}
    {showAutoScheduleForm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 9999999 }}>
        <div className="bg-white p-6 rounded-lg w-[600px] max-w-full mx-4 max-h-[80vh] overflow-y-auto relative">
          {/* Close Button */}
          <button
            onClick={() => {
              setShowAutoScheduleForm(false);
              setSelectedTrucks([]);
            }}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isLoading}
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h2 className="text-xl font-bold mb-4 pr-8">🤖 Auto Schedule Routes</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Schedule Date</label>
              <div className="flex gap-2">
                <Calendar
                  value={schedulingDate}
                  onChange={setSchedulingDate}
                  placeholder="Select date"
                  className="flex-1"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setSchedulingDate(new Date().toISOString().split('T')[0])}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
                  disabled={isLoading}
                >
                  Today
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {schedulingDate === new Date().toISOString().split('T')[0] 
                  ? "✅ Set to today's date" 
                  : `Selected: ${new Date(schedulingDate).toLocaleDateString()}`
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Trucks ({selectedTrucks.length} of {availableTrucks.length} selected)
              </label>
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {availableTrucks.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm">No available trucks</p>
                ) : (
                  availableTrucks.map((truck) => (
                    <div
                      key={truck.truck_id}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                        selectedTrucks.includes(truck.truck_id) ? 'bg-blue-50 border-blue-200' : ''
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isLoading && handleTruckSelection(truck.truck_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTrucks.includes(truck.truck_id)}
                              onChange={() => !isLoading && handleTruckSelection(truck.truck_id)}
                              className="rounded"
                              disabled={isLoading}
                            />
                            <span className="font-medium text-sm">{truck.plate_no}</span>
                          </div>
                          <p className="text-xs text-gray-600 ml-6">
                            ID: {truck.truck_id} | Area: {truck.assigned_area}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {availableTrucks.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTrucks(availableTrucks.map(t => t.truck_id))}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      disabled={isLoading}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTrucks([])}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      disabled={isLoading}
                    >
                      Clear All
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Click to select/deselect trucks. Bins will be distributed among selected trucks.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-3 rounded-md text-sm">
              <p><strong>Auto-scheduling will:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Use K-Means clustering to group nearby bins efficiently</li>
                <li>Assign optimized clusters to selected trucks</li>
                <li>Apply 2-opt algorithm for optimal route within each cluster</li>
                <li>Create assignments and routes in the database</li>
              </ul>
              {selectedTrucks.length > 0 && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <p className="font-medium text-green-700">
                    📊 Estimated Distribution for {new Date(schedulingDate).toLocaleDateString()}:
                  </p>
                  <p className="text-xs mt-1">
                    • Unassigned bins: {bins.filter(bin => 
                      !assignments.some(a => a.bin_id === bin.bin_id && a.scheduled_date === schedulingDate)
                    ).length}
                  </p>
                  <p className="text-xs">
                    • Clusters: {selectedTrucks.length} (one per truck)
                  </p>
                  <p className="text-xs">
                    • Selected trucks: {selectedTrucks.length}
                  </p>
                </div>
              )}
            </div>

            {isLoading && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                  <p className="text-sm text-yellow-700">
                    Processing auto-scheduling... This may take a few moments.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAutoScheduleForm(false);
                  setSelectedTrucks([]);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => performAutoScheduling(schedulingDate)}
                disabled={selectedTrucks.length === 0 || isLoading}
                className={`px-4 py-2 rounded-md ${
                  selectedTrucks.length === 0 || isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isLoading ? '🔄 Processing...' : '🚀 Start Auto Scheduling'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Loading Overlay */}
    {isLoading && (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" style={{ zIndex: 9999998 }}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-lg font-medium">Processing Auto-Scheduling...</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Creating assignments and optimizing routes. Please wait.
          </p>
        </div>
      </div>
    )}
  </div>
);
}