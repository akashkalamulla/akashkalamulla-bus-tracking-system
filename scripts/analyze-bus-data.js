/**
 * Bus Data Analysis Utility
 * 
 * Provides analysis and summary of generated bus data
 */

const fs = require('fs');
const path = require('path');

/**
 * Analyze bus data and display comprehensive summary
 */
function analyzeBusData() {
  try {
    // Read the generated bus data
    const busDataPath = path.join('data', 'buses.json');
    if (!fs.existsSync(busDataPath)) {
      console.log('❌ Bus data file not found. Run generate-data.js first.');
      return;
    }
    
    const buses = JSON.parse(fs.readFileSync(busDataPath, 'utf8'));
    
    console.log('🚐 BUS FLEET ANALYSIS');
    console.log('====================\n');
    
    // Basic stats
    console.log(`📊 Fleet Overview:`);
    console.log(`Total Buses: ${buses.length}`);
    console.log(`Bus ID Range: ${buses[0].BusID} to ${buses[buses.length - 1].BusID}\n`);
    
    // Status distribution
    const statusStats = buses.reduce((acc, bus) => {
      acc[bus.status] = (acc[bus.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`🚦 Status Distribution:`);
    Object.entries(statusStats).forEach(([status, count]) => {
      const percentage = ((count / buses.length) * 100).toFixed(1);
      console.log(`  ${status.toUpperCase()}: ${count} buses (${percentage}%)`);
    });
    console.log('');
    
    // Capacity analysis
    const capacities = buses.map(bus => bus.capacity);
    const avgCapacity = (capacities.reduce((a, b) => a + b, 0) / capacities.length).toFixed(1);
    const minCapacity = Math.min(...capacities);
    const maxCapacity = Math.max(...capacities);
    
    console.log(`🪑 Capacity Analysis:`);
    console.log(`  Average: ${avgCapacity} seats`);
    console.log(`  Range: ${minCapacity} - ${maxCapacity} seats`);
    console.log(`  Total Fleet Capacity: ${capacities.reduce((a, b) => a + b, 0)} passengers\n`);
    
    // License plate provinces
    const provinces = buses.reduce((acc, bus) => {
      const province = bus.license_plate.split('-')[0];
      acc[province] = (acc[province] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`🏛️ License Plate Distribution:`);
    Object.entries(provinces)
      .sort(([,a], [,b]) => b - a)
      .forEach(([province, count]) => {
        console.log(`  ${province}: ${count} buses`);
      });
    console.log('');
    
    // Route distribution
    const routeStats = buses.reduce((acc, bus) => {
      acc[bus.route_id] = (acc[bus.route_id] || []).concat(bus);
      return acc;
    }, {});
    
    console.log(`🛣️ Route Distribution:`);
    Object.entries(routeStats).forEach(([routeId, routeBuses]) => {
      const routeName = routeBuses[0].route_name;
      const activeCount = routeBuses.filter(b => b.status === 'active').length;
      console.log(`  ${routeId}: ${routeBuses.length} buses (${activeCount} active) - ${routeName}`);
    });
    console.log('');
    
    // Bus models
    const models = buses.reduce((acc, bus) => {
      acc[bus.bus_model] = (acc[bus.bus_model] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`🚌 Bus Models:`);
    Object.entries(models)
      .sort(([,a], [,b]) => b - a)
      .forEach(([model, count]) => {
        console.log(`  ${model}: ${count} buses`);
      });
    console.log('');
    
    // Fuel type distribution
    const fuelTypes = buses.reduce((acc, bus) => {
      acc[bus.fuel_type] = (acc[bus.fuel_type] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`⛽ Fuel Types:`);
    Object.entries(fuelTypes).forEach(([fuel, count]) => {
      const percentage = ((count / buses.length) * 100).toFixed(1);
      console.log(`  ${fuel}: ${count} buses (${percentage}%)`);
    });
    console.log('');
    
    // Amenities
    const acCount = buses.filter(bus => bus.ac_available).length;
    const wifiCount = buses.filter(bus => bus.wifi_available).length;
    const gpsCount = buses.filter(bus => bus.gps_enabled).length;
    
    console.log(`🎯 Amenities:`);
    console.log(`  Air Conditioning: ${acCount}/${buses.length} (${((acCount/buses.length)*100).toFixed(1)}%)`);
    console.log(`  WiFi Available: ${wifiCount}/${buses.length} (${((wifiCount/buses.length)*100).toFixed(1)}%)`);
    console.log(`  GPS Enabled: ${gpsCount}/${buses.length} (${((gpsCount/buses.length)*100).toFixed(1)}%)`);
    console.log('');
    
    // Sample bus details
    console.log(`📋 Sample Bus Details:`);
    const sampleBus = buses[0];
    console.log(`  ${sampleBus.BusID} (${sampleBus.license_plate})`);
    console.log(`  Route: ${sampleBus.route_name}`);
    console.log(`  Model: ${sampleBus.bus_model} (${sampleBus.manufacture_year})`);
    console.log(`  Capacity: ${sampleBus.capacity} passengers`);
    console.log(`  Driver: ${sampleBus.driver_name}`);
    console.log(`  Conductor: ${sampleBus.conductor_name}`);
    console.log(`  Status: ${sampleBus.status}`);
    console.log(`  Amenities: ${sampleBus.ac_available ? 'AC' : 'Non-AC'}, ${sampleBus.wifi_available ? 'WiFi' : 'No WiFi'}, GPS`);
    
  } catch (error) {
    console.error('❌ Error analyzing bus data:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  analyzeBusData();
}

module.exports = {
  analyzeBusData
};