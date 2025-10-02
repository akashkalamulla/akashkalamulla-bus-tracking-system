/**
 * Sri Lankan Bus Routes Generator
 * 
 * Generates realistic inter-provincial bus routes connecting major cities in Sri Lanka
 */

const { faker } = require('@faker-js/faker');

/**
 * Major Sri Lankan cities and their details
 */
const SRI_LANKAN_CITIES = {
  colombo: {
    name: 'Colombo',
    locations: [
      'Colombo Fort Bus Station',
      'Pettah Central Bus Stand',
      'Bastian Mawatha Bus Station',
      'Maharagama Bus Station'
    ]
  },
  kandy: {
    name: 'Kandy',
    locations: [
      'Kandy Central Bus Station',
      'Goods Shed Bus Station',
      'Clock Tower Bus Stand',
      'Katugastota Bus Station'
    ]
  },
  galle: {
    name: 'Galle',
    locations: [
      'Galle Bus Station',
      'Galle Fort Bus Stand',
      'Akmeemana Bus Station',
      'Baddegama Bus Station'
    ]
  },
  jaffna: {
    name: 'Jaffna',
    locations: [
      'Jaffna Central Bus Station',
      'Jaffna Town Bus Stand',
      'Chavakachcheri Bus Station',
      'Point Pedro Bus Station'
    ]
  },
  anuradhapura: {
    name: 'Anuradhapura',
    locations: [
      'Anuradhapura New Bus Station',
      'Anuradhapura Old Bus Station',
      'Sacred City Bus Stand',
      'Mihintale Bus Station'
    ]
  },
  negombo: {
    name: 'Negombo',
    locations: [
      'Negombo Bus Station',
      'Katunayake Bus Stand',
      'Waikkal Bus Station',
      'Chilaw Bus Station'
    ]
  },
  matara: {
    name: 'Matara',
    locations: [
      'Matara Bus Station',
      'Matara Fort Bus Stand',
      'Weligama Bus Station',
      'Mirissa Bus Station'
    ]
  },
  trincomalee: {
    name: 'Trincomalee',
    locations: [
      'Trincomalee Bus Station',
      'Trinco Town Bus Stand',
      'Kinniya Bus Station',
      'Uppuveli Bus Station'
    ]
  },
  batticaloa: {
    name: 'Batticaloa',
    locations: [
      'Batticaloa Bus Station',
      'Batti Central Bus Stand',
      'Kallady Bus Station',
      'Pasikudah Bus Station'
    ]
  },
  ratnapura: {
    name: 'Ratnapura',
    locations: [
      'Ratnapura Bus Station',
      'Gem City Bus Stand',
      'Embilipitiya Bus Station',
      'Balangoda Bus Station'
    ]
  }
};

/**
 * Predefined realistic Sri Lankan inter-provincial routes
 */
const ROUTE_TEMPLATES = [
  {
    routeId: 'route_001',
    from: 'colombo',
    to: 'kandy',
    routeName: 'Colombo - Kandy Express',
    description: 'Direct express service connecting commercial capital Colombo to the cultural capital Kandy via scenic hill country route',
    totalStops: 12,
    intermediateStops: [
      'Kelaniya', 'Kadawatha', 'Gampaha', 'Veyangoda', 
      'Kegalle', 'Mawanella', 'Kadugannawa', 'Peradeniya'
    ]
  },
  {
    routeId: 'route_002',
    from: 'colombo',
    to: 'galle',
    routeName: 'Colombo - Galle Coastal Express',
    description: 'Premium coastal highway service connecting Colombo to the historic southern port city of Galle',
    totalStops: 10,
    intermediateStops: [
      'Mount Lavinia', 'Panadura', 'Kalutara', 'Beruwala', 
      'Aluthgama', 'Bentota', 'Hikkaduwa', 'Unawatuna'
    ]
  },
  {
    routeId: 'route_003',
    from: 'colombo',
    to: 'jaffna',
    routeName: 'Colombo - Jaffna Northern Express',
    description: 'Long-distance express service to the northern peninsula via A9 highway with air-conditioned comfort',
    totalStops: 15,
    intermediateStops: [
      'Negombo', 'Chilaw', 'Puttalam', 'Anuradhapura', 'Medawachchiya', 
      'Vavuniya', 'Cheddikulam', 'Kilinochchi', 'Elephant Pass', 
      'Chavakachcheri', 'Nallur'
    ]
  },
  {
    routeId: 'route_004',
    from: 'kandy',
    to: 'trincomalee',
    routeName: 'Kandy - Trincomalee Hill-Coast Express',
    description: 'Scenic route from hill capital to eastern coast via ancient cities and wildlife reserves',
    totalStops: 13,
    intermediateStops: [
      'Dambulla', 'Sigiriya', 'Habarane', 'Polonnaruwa', 
      'Batticaloa Junction', 'Valaichchenai', 'Muttur', 
      'Somawathiya', 'Seruwawila', 'Nilaveli'
    ]
  },
  {
    routeId: 'route_005',
    from: 'galle',
    to: 'ratnapura',
    routeName: 'Galle - Ratnapura Gem Route Express',
    description: 'Interior route connecting southern coast to gem mining capital through rubber plantations and rainforests',
    totalStops: 11,
    intermediateStops: [
      'Elpitiya', 'Pitigala', 'Deniyaya', 'Morawaka', 
      'Akuressa', 'Urubokka', 'Pelmadulla', 'Eheliyagoda', 'Kuruwita'
    ]
  }
];

/**
 * Generate a single Sri Lankan bus route
 */
function generateSriLankanRoute(template) {
  const fromCity = SRI_LANKAN_CITIES[template.from];
  const toCity = SRI_LANKAN_CITIES[template.to];
  
  // Get random locations from source and destination cities
  const startLocation = faker.helpers.arrayElement(fromCity.locations);
  const endLocation = faker.helpers.arrayElement(toCity.locations);
  
  // Generate timestamps
  const createdAt = faker.date.past({ years: 2 }).toISOString();
  const updatedAt = faker.date.between({ 
    from: createdAt, 
    to: new Date() 
  }).toISOString();
  
  return {
    RouteID: template.routeId,
    route_name: template.routeName,
    start_location: startLocation,
    end_location: endLocation,
    description: template.description,
    total_stops: template.totalStops,
    intermediate_stops: template.intermediateStops,
    from_city: fromCity.name,
    to_city: toCity.name,
    route_type: 'inter-provincial',
    distance_km: faker.number.int({ min: 80, max: 400 }),
    estimated_duration_hours: faker.number.float({ min: 2.5, max: 8.0, precision: 0.5 }),
    fare_rs: faker.number.int({ min: 150, max: 800 }),
    service_frequency: faker.helpers.arrayElement(['Every 30 minutes', 'Every hour', 'Every 2 hours']),
    operates_on: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    first_departure: '05:00',
    last_departure: '20:00',
    created_at: createdAt,
    updated_at: updatedAt
  };
}

/**
 * Generate all 5 Sri Lankan inter-provincial bus routes
 */
function generateSriLankanRoutes() {
  console.log('🇱🇰 Generating Sri Lankan inter-provincial bus routes...\n');
  
  const routes = ROUTE_TEMPLATES.map(template => {
    const route = generateSriLankanRoute(template);
    console.log(`✅ ${route.RouteID}: ${route.route_name}`);
    console.log(`   ${route.from_city} (${route.start_location}) → ${route.to_city} (${route.end_location})`);
    console.log(`   ${route.total_stops} stops, ${route.distance_km}km, ~${route.estimated_duration_hours}hrs`);
    console.log(`   Fare: Rs. ${route.fare_rs}, ${route.service_frequency}\n`);
    return route;
  });
  
  console.log(`🎉 Generated ${routes.length} Sri Lankan inter-provincial routes`);
  return routes;
}

/**
 * Display route summary
 */
function displayRouteSummary(routes) {
  console.log('\n📋 ROUTE SUMMARY');
  console.log('================');
  
  routes.forEach(route => {
    console.log(`${route.RouteID}: ${route.route_name}`);
    console.log(`  Route: ${route.from_city} → ${route.to_city}`);
    console.log(`  Stops: ${route.total_stops} | Distance: ${route.distance_km}km`);
    console.log(`  Fare: Rs. ${route.fare_rs} | Frequency: ${route.service_frequency}`);
    console.log(`  Created: ${route.created_at.split('T')[0]}`);
    console.log('');
  });
}

/**
 * Main function to generate and display routes
 */
function main() {
  try {
    const routes = generateSriLankanRoutes();
    displayRouteSummary(routes);
    
    // Save to JSON file
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = 'data';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'sri-lankan-routes.json');
    fs.writeFileSync(outputPath, JSON.stringify(routes, null, 2));
    console.log(`💾 Routes saved to ${outputPath}`);
    
    return routes;
    
  } catch (error) {
    console.error('❌ Error generating Sri Lankan routes:', error);
    process.exit(1);
  }
}

// Export functions for use in other modules
module.exports = {
  generateSriLankanRoutes,
  generateSriLankanRoute,
  displayRouteSummary,
  SRI_LANKAN_CITIES,
  ROUTE_TEMPLATES
};

// Run if called directly
if (require.main === module) {
  main();
}