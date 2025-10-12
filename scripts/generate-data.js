/**
 * Data Generation Script for Bus Tracking System
 *
 * This script generates fake data for:
 * - Routes
 * - Buses
 * - Live Locations
 *
 * Usage: node scripts/generate-data.js
 */

const { faker } = require('@faker-js/faker');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { generateSriLankanRoutes } = require('./sri-lankan-routes');

// Configuration
const CONFIG = {
  routes: 5, // Use Sri Lankan routes
  busesPerRoute: 5,
  locationsPerBus: 20,
  scheduleDays: 7, // Generate 1 week of schedules
  outputDir: 'data',
};

/**
 * Generate route data using Sri Lankan routes
 */
function generateRoutes() {
  return generateSriLankanRoutes();
}

/**
 * Sri Lankan province codes for license plates
 */
const SRI_LANKAN_PROVINCES = [
  'WP', // Western Province
  'CP', // Central Province
  'SP', // Southern Province
  'NP', // Northern Province
  'EP', // Eastern Province
  'NW', // North Western Province
  'NC', // North Central Province
  'UP', // Uva Province
  'SB', // Sabaragamuwa Province
];

/**
 * Generate Sri Lankan format license plate
 */
function generateSriLankanLicensePlate() {
  const province = faker.helpers.arrayElement(SRI_LANKAN_PROVINCES);
  const number = faker.number.int({ min: 1000, max: 9999 });
  return `${province}-${number}`;
}

/**
 * Generate bus data with Sri Lankan specifications
 */
function generateBuses(routes, busesPerRoute) {
  const buses = [];
  let busCounter = 1;

  routes.forEach((route, routeIndex) => {
    console.log(`🚐 Generating buses for ${route.route_name}...`);

    for (let i = 0; i < busesPerRoute; i++) {
      // Generate timestamps
      const createdAt = faker.date.past({ years: 3 }).toISOString();
      const updatedAt = faker.date.between({
        from: createdAt,
        to: new Date(),
      }).toISOString();

      // Determine status - mostly active with some maintenance
      let status;
      const statusRandom = Math.random();
      if (statusRandom < 0.8) {
        status = 'active';
      } else if (statusRandom < 0.95) {
        status = 'maintenance';
      } else {
        status = 'out_of_service';
      }

      const bus = {
        BusID: `bus_${busCounter.toString().padStart(3, '0')}`,
        route_id: route.RouteID,
        capacity: faker.number.int({ min: 45, max: 55 }),
        license_plate: generateSriLankanLicensePlate(),
        status: status,
        // Additional realistic Sri Lankan bus attributes
        bus_model: faker.helpers.arrayElement([
          'Tata LP 909', 'Ashok Leyland Viking', 'EICHER Pro 1110XP',
          'Mahindra Tourister COSMO', 'Force Traveller 3350',
          'Tata Ultra 1012', 'Ashok Leyland Lynx', 'EICHER Pro 1049',
        ]),
        manufacture_year: faker.number.int({ min: 2015, max: 2024 }),
        fuel_type: faker.helpers.arrayElement(['Diesel', 'CNG']),
        ac_available: faker.helpers.arrayElement([true, false]),
        wifi_available: faker.helpers.arrayElement([true, false]),
        gps_enabled: true, // All buses have GPS for tracking
        driver_name: faker.person.fullName(),
        conductor_name: faker.person.fullName(),
        insurance_expiry: faker.date.future({ years: 1 }).toISOString().split('T')[0],
        last_service_date: faker.date.recent({ days: 90 }).toISOString().split('T')[0],
        next_service_due: faker.date.future({ days: 30 }).toISOString().split('T')[0],
        route_name: route.route_name,
        created_at: createdAt,
        updated_at: updatedAt,
      };

      buses.push(bus);

      console.log(`  ✅ ${bus.BusID}: ${bus.license_plate} (${bus.capacity} seats, ${bus.status})`);
      busCounter++;
    }
    console.log('');
  });

  console.log(`🎉 Generated ${buses.length} buses total`);

  // Display status summary
  const statusCounts = buses.reduce((acc, bus) => {
    acc[bus.status] = (acc[bus.status] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Bus Status Summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} buses`);
  });
  console.log('');

  return buses;
}

/**
 * Route duration mapping (in hours)
 */
const ROUTE_DURATIONS = {
  route_001: 3.5, // Colombo - Kandy Express
  route_002: 2.5, // Colombo - Galle Coastal Express
  route_003: 8.0, // Colombo - Jaffna Northern Express
  route_004: 4.0, // Kandy - Trincomalee Hill-Coast Express
  route_005: 1.5, // Galle - Ratnapura Gem Route Express
};

/**
 * Daily trip schedule (departure times)
 */
const DAILY_TRIPS = [
  { time: '06:00', period: 'morning' },
  { time: '14:00', period: 'afternoon' },
  { time: '19:00', period: 'evening' },
];

/**
 * Calculate arrival time based on departure time and route duration
 */
function calculateArrivalTime(departureTime, routeDuration) {
  const [hours, minutes] = departureTime.split(':').map(Number);
  const departureMinutes = hours * 60 + minutes;
  const durationMinutes = routeDuration * 60;
  const arrivalMinutes = departureMinutes + durationMinutes;

  const arrivalHours = Math.floor(arrivalMinutes / 60) % 24;
  const arrivalMins = arrivalMinutes % 60;

  return `${arrivalHours.toString().padStart(2, '0')}:${arrivalMins.toString().padStart(2, '0')}`;
}

/**
 * Generate bus schedules for one week
 */
function generateBusSchedules(buses, routes) {
  const schedules = [];
  let scheduleCounter = 1;

  // Create route lookup for easy access
  const routeLookup = routes.reduce((acc, route) => {
    acc[route.RouteID] = route;
    return acc;
  }, {});

  console.log('📅 Generating weekly bus schedules...\n');

  // Generate schedules for 7 days
  const startDate = new Date();

  for (let day = 0; day < 7; day++) {
    const scheduleDate = new Date(startDate);
    scheduleDate.setDate(startDate.getDate() + day);
    const dateString = scheduleDate.toISOString().split('T')[0];

    const dayName = scheduleDate.toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`📆 Generating schedules for ${dayName} (${dateString})...`);

    buses.forEach((bus) => {
      const route = routeLookup[bus.route_id];
      const routeDuration = ROUTE_DURATIONS[bus.route_id];

      // Generate 3 trips per day for each bus
      DAILY_TRIPS.forEach((trip, tripIndex) => {
        const arrivalTime = calculateArrivalTime(trip.time, routeDuration);

        // Create departure and arrival datetime strings
        const departureDateTime = `${dateString}T${trip.time}:00.000Z`;
        const arrivalDateTime = `${dateString}T${arrivalTime}:00.000Z`;

        // Handle next day arrival
        let finalArrivalDateTime = arrivalDateTime;
        if (arrivalTime < trip.time) {
          const nextDay = new Date(scheduleDate);
          nextDay.setDate(scheduleDate.getDate() + 1);
          const nextDateString = nextDay.toISOString().split('T')[0];
          finalArrivalDateTime = `${nextDateString}T${arrivalTime}:00.000Z`;
        }

        const schedule = {
          ScheduleID: `schedule_${scheduleCounter.toString().padStart(4, '0')}`,
          BusID: bus.BusID,
          route_id: bus.route_id,
          route_name: route.route_name,
          schedule_date: dateString,
          day_of_week: dayName,
          trip_number: tripIndex + 1,
          trip_period: trip.period,
          departure_time: trip.time,
          estimated_arrival_time: arrivalTime,
          departure_datetime: departureDateTime,
          estimated_arrival_datetime: finalArrivalDateTime,
          trip_status: 'scheduled',
          duration_hours: routeDuration,
          start_location: route.start_location,
          end_location: route.end_location,
          driver_name: bus.driver_name,
          conductor_name: bus.conductor_name,
          bus_capacity: bus.capacity,
          license_plate: bus.license_plate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        schedules.push(schedule);
        scheduleCounter++;
      });
    });

    const dayScheduleCount = buses.length * DAILY_TRIPS.length;
    console.log(`  ✅ Generated ${dayScheduleCount} schedules for ${dayName}`);
  }

  console.log(`\n🎉 Generated ${schedules.length} total schedules for the week`);

  // Display schedule summary
  displayScheduleSummary(schedules);

  return schedules;
}

/**
 * Display schedule summary
 */
function displayScheduleSummary(schedules) {
  console.log('\n📊 SCHEDULE SUMMARY');
  console.log('==================');

  // Group by route
  const routeSchedules = schedules.reduce((acc, schedule) => {
    acc[schedule.route_id] = (acc[schedule.route_id] || []).concat(schedule);
    return acc;
  }, {});

  console.log('\n🛣️ Schedules by Route:');
  Object.entries(routeSchedules).forEach(([routeId, routeScheduleList]) => {
    const routeName = routeScheduleList[0].route_name;
    const duration = routeScheduleList[0].duration_hours;
    console.log(`  ${routeId}: ${routeScheduleList.length} trips - ${routeName} (${duration}h)`);
  });

  // Group by day
  const daySchedules = schedules.reduce((acc, schedule) => {
    acc[schedule.day_of_week] = (acc[schedule.day_of_week] || []).concat(schedule);
    return acc;
  }, {});

  console.log('\n📅 Schedules by Day:');
  Object.entries(daySchedules).forEach(([day, dayScheduleList]) => {
    console.log(`  ${day}: ${dayScheduleList.length} trips`);
  });

  // Group by trip period
  const periodSchedules = schedules.reduce((acc, schedule) => {
    acc[schedule.trip_period] = (acc[schedule.trip_period] || []).concat(schedule);
    return acc;
  }, {});

  console.log('\n🕐 Schedules by Time Period:');
  Object.entries(periodSchedules).forEach(([period, periodScheduleList]) => {
    console.log(`  ${period}: ${periodScheduleList.length} trips`);
  });

  // Sample schedule
  console.log('\n📋 Sample Schedule:');
  const sample = schedules[0];
  console.log(`  ${sample.ScheduleID}: ${sample.route_name}`);
  console.log(`  Bus: ${sample.BusID} (${sample.license_plate})`);
  console.log(`  Date: ${sample.schedule_date} (${sample.day_of_week})`);
  console.log(`  Time: ${sample.departure_time} → ${sample.estimated_arrival_time} (${sample.duration_hours}h)`);
  console.log(`  Period: ${sample.trip_period} trip #${sample.trip_number}`);
  console.log(`  Driver: ${sample.driver_name}, Conductor: ${sample.conductor_name}`);
  console.log(`  Status: ${sample.trip_status}`);
}
/**
 * Generate live location data
 */
function generateLiveLocations(buses, locationsPerBus) {
  const locations = [];
  const now = new Date();

  buses.forEach((bus) => {
    // Generate locations for the past few hours
    for (let i = 0; i < locationsPerBus; i++) {
      const timestamp = new Date(now.getTime() - (i * 5 * 60 * 1000)); // 5 minutes apart
      const ttl = Math.floor((timestamp.getTime() + (24 * 60 * 60 * 1000)) / 1000); // 24 hours TTL

      const location = {
        BusID: bus.BusID,
        timestamp: timestamp.toISOString(),
        latitude: parseFloat(faker.location.latitude()),
        longitude: parseFloat(faker.location.longitude()),
        speed: faker.number.int({ min: 0, max: 80 }),
        heading: faker.number.int({ min: 0, max: 360 }),
        route_id: bus.route_id,
        geohash: faker.string.alphanumeric(8),
        ttl: ttl,
      };
      locations.push(location);
    }
  });

  return locations;
}

/**
 * Save data to JSON files
 */
function saveData(data, filename) {
  const outputPath = path.join(CONFIG.outputDir, filename);

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ Generated ${data.length} records saved to ${outputPath}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚌 Generating bus tracking system data...\n');

  try {
    // Generate routes
    console.log('🇱🇰 Generating Sri Lankan routes...');
    const routes = generateRoutes();
    saveData(routes, 'routes.json');

    // Generate buses
    console.log('🚐 Generating buses...');
    const buses = generateBuses(routes, CONFIG.busesPerRoute);
    saveData(buses, 'buses.json');

    // Generate bus schedules
    console.log('📅 Generating bus schedules...');
    const schedules = generateBusSchedules(buses, routes);
    saveData(schedules, 'schedules.json');

    // Generate live locations
    console.log('📍 Generating live locations...');
    const liveLocations = generateLiveLocations(buses, CONFIG.locationsPerBus);
    saveData(liveLocations, 'live-locations.json');

    console.log('\n🎉 Data generation completed successfully!');
    console.log('\nGenerated:');
    console.log(`- ${routes.length} routes`);
    console.log(`- ${buses.length} buses`);
    console.log(`- ${schedules.length} schedules (${CONFIG.scheduleDays} days)`);
    console.log(`- ${liveLocations.length} live locations`);
  } catch (error) {
    console.error('❌ Error generating data:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateRoutes,
  generateBuses,
  generateLiveLocations,
  generateBusSchedules,
  generateSriLankanLicensePlate,
  calculateArrivalTime,
  displayScheduleSummary,
  SRI_LANKAN_PROVINCES,
  ROUTE_DURATIONS,
  DAILY_TRIPS,
};
