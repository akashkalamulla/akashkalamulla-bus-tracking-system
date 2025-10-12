/**
 * Bus Schedule Analysis Utility
 *
 * Analyzes and displays comprehensive schedule data
 */

const fs = require('fs');
const path = require('path');

/**
 * Analyze schedule data and display comprehensive summary
 */
function analyzeScheduleData() {
  try {
    // Read the generated schedule data
    const scheduleDataPath = path.join('data', 'schedules.json');
    if (!fs.existsSync(scheduleDataPath)) {
      console.log('❌ Schedule data file not found. Run generate-data.js first.');
      return;
    }

    const schedules = JSON.parse(fs.readFileSync(scheduleDataPath, 'utf8'));

    console.log('📅 BUS SCHEDULE ANALYSIS');
    console.log('========================\n');

    // Basic stats
    console.log('📊 Schedule Overview:');
    console.log(`Total Schedules: ${schedules.length}`);
    console.log(`Schedule ID Range: ${schedules[0].ScheduleID} to ${schedules[schedules.length - 1].ScheduleID}`);

    // Date range
    const dates = [...new Set(schedules.map((s) => s.schedule_date))].sort();
    console.log(`Date Range: ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} days)\n`);

    // Route analysis
    const routeStats = schedules.reduce((acc, schedule) => {
      if (!acc[schedule.route_id]) {
        acc[schedule.route_id] = {
          route_name: schedule.route_name,
          duration: schedule.duration_hours,
          schedules: [],
        };
      }
      acc[schedule.route_id].schedules.push(schedule);
      return acc;
    }, {});

    console.log('🛣️ Route Schedule Analysis:');
    Object.entries(routeStats).forEach(([routeId, stats]) => {
      console.log(`  ${routeId}: ${stats.schedules.length} trips - ${stats.route_name}`);
      console.log(`    Duration: ${stats.duration}h | Daily trips: ${stats.schedules.length / dates.length}`);
    });
    console.log('');

    // Daily distribution
    const dailyStats = schedules.reduce((acc, schedule) => {
      const key = `${schedule.day_of_week} (${schedule.schedule_date})`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    console.log('📅 Daily Schedule Distribution:');
    Object.entries(dailyStats).forEach(([day, count]) => {
      console.log(`  ${day}: ${count} trips`);
    });
    console.log('');

    // Time period analysis
    const periodStats = schedules.reduce((acc, schedule) => {
      acc[schedule.trip_period] = (acc[schedule.trip_period] || 0) + 1;
      return acc;
    }, {});

    console.log('🕐 Time Period Distribution:');
    Object.entries(periodStats).forEach(([period, count]) => {
      const percentage = ((count / schedules.length) * 100).toFixed(1);
      console.log(`  ${period.toUpperCase()}: ${count} trips (${percentage}%)`);
    });
    console.log('');

    // Bus utilization
    const busStats = schedules.reduce((acc, schedule) => {
      acc[schedule.BusID] = (acc[schedule.BusID] || 0) + 1;
      return acc;
    }, {});

    const tripsPerBus = Object.values(busStats);
    const avgTripsPerBus = (tripsPerBus.reduce((a, b) => a + b, 0) / tripsPerBus.length).toFixed(1);

    console.log('🚌 Bus Utilization:');
    console.log(`  Buses in service: ${Object.keys(busStats).length}`);
    console.log(`  Average trips per bus: ${avgTripsPerBus} over ${dates.length} days`);
    console.log(`  Trips per bus per day: ${(avgTripsPerBus / dates.length).toFixed(1)}`);
    console.log('');

    // Departure time analysis
    const departureStats = schedules.reduce((acc, schedule) => {
      acc[schedule.departure_time] = (acc[schedule.departure_time] || 0) + 1;
      return acc;
    }, {});

    console.log('🕰️ Departure Time Distribution:');
    Object.entries(departureStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([time, count]) => {
        console.log(`  ${time}: ${count} departures`);
      });
    console.log('');

    // Route duration analysis
    console.log('⏱️ Route Duration Analysis:');
    Object.entries(routeStats).forEach(([routeId, stats]) => {
      const sampleSchedule = stats.schedules[0];
      console.log(`  ${routeId}: ${stats.duration}h (${sampleSchedule.departure_time} → ${sampleSchedule.estimated_arrival_time})`);
    });
    console.log('');

    // Cross-day trips (overnight)
    const overnightTrips = schedules.filter((schedule) => {
      const depTime = schedule.departure_time;
      const arrTime = schedule.estimated_arrival_time;
      return arrTime < depTime; // Arrival time is less than departure time (next day)
    });

    console.log('🌙 Overnight Trips:');
    console.log(`  ${overnightTrips.length} trips arrive the next day`);
    if (overnightTrips.length > 0) {
      const overnightRoutes = [...new Set(overnightTrips.map((t) => t.route_id))];
      console.log(`  Routes with overnight trips: ${overnightRoutes.join(', ')}`);
    }
    console.log('');

    // Sample schedule details
    console.log('📋 Sample Schedule Details:');
    const sample = schedules[0];
    console.log(`  Schedule ID: ${sample.ScheduleID}`);
    console.log(`  Route: ${sample.route_name} (${sample.route_id})`);
    console.log(`  Bus: ${sample.BusID} (${sample.license_plate})`);
    console.log(`  Date: ${sample.schedule_date} (${sample.day_of_week})`);
    console.log(`  Trip: ${sample.trip_period} #${sample.trip_number}`);
    console.log(`  Time: ${sample.departure_time} → ${sample.estimated_arrival_time}`);
    console.log(`  Duration: ${sample.duration_hours} hours`);
    console.log(`  Route: ${sample.start_location} → ${sample.end_location}`);
    console.log(`  Crew: Driver ${sample.driver_name}, Conductor ${sample.conductor_name}`);
    console.log(`  Capacity: ${sample.bus_capacity} passengers`);
    console.log(`  Status: ${sample.trip_status}`);
  } catch (error) {
    console.error('❌ Error analyzing schedule data:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  analyzeScheduleData();
}

module.exports = {
  analyzeScheduleData,
};
