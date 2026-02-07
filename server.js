const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');
const { createClerkClient } = require('@clerk/backend');
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (dotenvResult.error) {
  console.log('[WARN] .env not loaded:', dotenvResult.error.message);
} else {
  console.log('[OK] .env loaded from:', path.resolve(__dirname, '.env'));
}

// Load manual chain menu data (accurate nutrition from official sources)
const chainMenuData = require('./chain-menus.json');
console.log('[OK] Chain menu data loaded:', Object.keys(chainMenuData).join(', '));

// Known chain registry — detectChain() matches against these keys,
// and the API Ninjas fallback uses ketoQueries for nutrition lookups
const CHAIN_REGISTRY = {
  'chipotle':             { name: 'Chipotle',                menuKey: 'chipotle',          ketoQueries: ['chipotle carnitas salad bowl no rice no beans','chipotle steak bowl lettuce cheese guacamole','chipotle chicken salad no rice'] },
  'five guys':            { name: 'Five Guys',               menuKey: 'fiveguys',          ketoQueries: ['five guys bunless burger','five guys lettuce wrap bacon cheeseburger','five guys bunless little cheeseburger'] },
  'panera':               { name: 'Panera Bread',            menuKey: 'panera',            ketoQueries: ['panera caesar salad chicken no croutons','panera greek salad','panera avocado egg white'] },
  'subway':               { name: 'Subway',                  menuKey: 'subway',            ketoQueries: ['subway salad bowl turkey','subway chicken bacon ranch salad','subway tuna salad bowl'] },
  'chick-fil-a':          { name: 'Chick-fil-A',             menuKey: 'chickfila',         ketoQueries: ['chick fil a grilled chicken nuggets','chick fil a cobb salad no corn','chick fil a grilled chicken'] },
  'mcdonald':             { name: "McDonald's",              menuKey: 'mcdonalds',         ketoQueries: ['mcdonalds quarter pounder no bun','mcdonalds bacon egg cheese no muffin','mcdonalds sausage burrito no tortilla','quarter pounder patty','double cheeseburger no bun','bacon egg and cheese no biscuit','mcdonald grilled chicken','side salad'] },
  'wendy':                { name: "Wendy's",                 menuKey: 'wendys',            ketoQueries: ['wendys baconator no bun','wendys dave single no bun','wendys caesar salad grilled chicken'] },
  'burger king':          { name: 'Burger King',             menuKey: 'burgerking',        ketoQueries: ['whopper patty no bun','double whopper no bun','bacon king no bun','grilled chicken sandwich no bun'] },
  'taco bell':            { name: 'Taco Bell',               menuKey: 'tacobell',          ketoQueries: ['power bowl no rice no beans','taco bell steak','cheese quesadilla','black beans'] },
  'dunkin':               { name: "Dunkin'",                 menuKey: 'dunkin',            ketoQueries: ['dunkin egg and cheese','bacon egg and cheese wake up wrap','sausage egg and cheese','coffee black'] },
  'starbucks':            { name: 'Starbucks',               ketoQueries: ['starbucks egg bites','bacon gruyere egg bites','chicken sausage egg bites','unsweetened iced coffee'] },
  'olive garden':         { name: 'Olive Garden',            ketoQueries: ['olive garden grilled chicken','olive garden shrimp scampi no pasta','olive garden salmon'] },
  'red lobster':          { name: 'Red Lobster',             ketoQueries: ['red lobster live maine lobster','red lobster wood-grilled lobster tail','red lobster grilled salmon'] },
  'buffalo wild wings':   { name: 'Buffalo Wild Wings',      menuKey: 'buffalowildwings',  ketoQueries: ['buffalo wild wings traditional wings','buffalo wild wings naked tenders','buffalo wild wings caesar salad'] },
  'outback':              { name: 'Outback Steakhouse',      menuKey: 'outback',           ketoQueries: ['outback ribeye steak','outback victoria filet','outback grilled chicken'] },
  'texas roadhouse':      { name: 'Texas Roadhouse',         menuKey: 'texasroadhouse',    ketoQueries: ['texas roadhouse ribeye','texas roadhouse sirloin','texas roadhouse grilled chicken salad'] },
  'longhorn':             { name: 'LongHorn Steakhouse',     menuKey: 'longhorn',          ketoQueries: ['longhorn outlaw ribeye','longhorn flo filet','longhorn grilled salmon'] },
  'applebee':             { name: "Applebee's",              ketoQueries: ['applebees bourbon street steak','applebees grilled chicken caesar salad','applebees shrimp'] },
  'chili':                { name: "Chili's",                 ketoQueries: ['chilis ancho salmon','chilis grilled chicken salad','chilis chicken fajitas no tortilla'] },
  'tgi friday':           { name: "TGI Friday's",            ketoQueries: ['tgi fridays grilled salmon','tgi fridays steak','tgi fridays caesar salad'] },
  'in-n-out':             { name: 'In-N-Out Burger',         menuKey: 'innout',            ketoQueries: ['in n out protein style burger','in n out double double protein style','in n out cheeseburger lettuce wrap'] },
  'shake shack':          { name: 'Shake Shack',             ketoQueries: ['shake shack lettuce wrap burger','shake shack shackburger no bun','shake shack cheese fries no fries'] },
  'jimmy john':           { name: "Jimmy John's",            ketoQueries: ['jimmy johns unwich turkey','jimmy johns lettuce wrap italian','jimmy johns unwich club'] },
  'jersey mike':          { name: "Jersey Mike's",           ketoQueries: ['jersey mikes sub in a tub','jersey mikes chipotle cheesesteak bowl','jersey mikes club bowl'] },
  'qdoba':                { name: 'Qdoba',                   ketoQueries: ['qdoba steak bowl no rice','qdoba chicken salad','qdoba fajita bowl no beans'] },
  'moe':                  { name: "Moe's Southwest Grill",   ketoQueries: ['moes chicken bowl no rice','moes steak salad','moes carnitas bowl'] },
  'wingstop':             { name: 'Wingstop',                menuKey: 'wingstop',          ketoQueries: ['wingstop classic wings','wingstop original hot wings','wingstop lemon pepper wings'] },
  'popeyes':              { name: 'Popeyes',                 ketoQueries: ['popeyes blackened chicken tenders','popeyes naked chicken','popeyes green beans'] },
  'kfc':                  { name: 'KFC',                     ketoQueries: ['kfc grilled chicken breast','kfc original chicken no breading','kfc green beans'] },
  'panda express':        { name: 'Panda Express',           ketoQueries: ['panda express grilled teriyaki chicken','panda express string bean chicken breast','panda express mushroom chicken'] },
  'cheesecake factory':   { name: 'The Cheesecake Factory',  ketoQueries: ['cheesecake factory grilled salmon','cheesecake factory steak','cheesecake factory chicken salad'] },
  'red robin':            { name: 'Red Robin',               ketoQueries: ['red robin lettuce wrap burger','red robin tavern burger no bun','red robin wedgie burger'] },
  'carrabba':             { name: "Carrabba's Italian Grill",ketoQueries: ['carrabbas chicken bryan','carrabbas grilled salmon','carrabbas sirloin marsala'] }
};

// Derive the chain-menus.json key from a chain's display name
// Returns the chain-menus.json key for a CHAIN_REGISTRY entry (null if no curated data)
function getChainMenuKey(chainInfo) {
  return chainInfo?.menuKey || null;
}

console.log('=== STARTUP DIAGNOSTICS ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('GOOGLE_PLACES_API_KEY exists:', !!process.env.GOOGLE_PLACES_API_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);

// Initialize Clerk client
let clerkClient = null;
if (process.env.CLERK_SECRET_KEY) {
  clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  console.log('[OK] Clerk client initialized');
} else {
  console.log('[WARN] Clerk secret key not found - auth verification disabled');
}

// Initialize OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('[OK] OpenAI client initialized');
} else {
  console.log('[WARN] OpenAI API key not found - AI suggestions will be disabled');
}

// Try to load database with error handling
let initDatabase, saveReview, getReviews, getUserReviews, deleteReview, updateReview, getRestaurantSignals, upsertRestaurantSignals;

try {
  console.log('Attempting to load database module...');
  const db = require('./database');
  initDatabase = db.initDatabase;
  saveReview = db.saveReview;
  getReviews = db.getReviews;
  getUserReviews = db.getUserReviews;
  deleteReview = db.deleteReview;
  updateReview = db.updateReview;
  getRestaurantSignals = db.getRestaurantSignals;
  upsertRestaurantSignals = db.upsertRestaurantSignals;

  console.log('[OK] Database module loaded successfully');
} catch (error) {
  console.error('[ERROR] FAILED TO LOAD DATABASE MODULE:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Middleware to verify Clerk token and extract user ID
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!clerkClient) {
    return res.status(500).json({ error: 'Auth service not configured' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { sub: userId } = await clerkClient.verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    console.error('[ERROR] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Keto Hunter API is running!',
    database: !!saveReview ? 'connected' : 'NOT CONNECTED - check logs',
    clerk: !!clerkClient ? 'configured' : 'NOT CONFIGURED',
    timestamp: new Date().toISOString()
  });
});

// Geocode an address to lat/lng
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: address,
          key: process.env.GOOGLE_PLACES_API_KEY
        }
      }
    );

    console.log('Geocode request:', address, '| Google status:', response.data.status, '| results:', response.data.results?.length || 0);

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      const formattedAddress = response.data.results[0].formatted_address;
      
      res.json({
        success: true,
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: formattedAddress
      });
    } else {
      console.log('Geocode failed — Google error_message:', response.data.error_message || 'none');
      res.status(404).json({ 
        error: 'Location not found. Try a more specific address.',
        success: false 
      });
    }
  } catch (error) {
    console.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to geocode address', success: false });
  }
});

// Search for keto-friendly restaurants
app.post('/api/search-keto-restaurants', async (req, res) => {
  try {
    const { latitude, longitude, radius = 8000, searchQuery } = req.body;
    
    console.log(`[SEARCH REQUEST] Lat: ${latitude}, Lng: ${longitude}, Radius: ${radius}m (${(radius / 1609.34).toFixed(1)} miles)`);
    
    // If user provided a specific search term, do a text search
    if (searchQuery && searchQuery.trim()) {
      
      const textSearchResponse = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery: searchQuery,
          locationBias: {
            circle: {
              center: {
                latitude: latitude,
                longitude: longitude
              },
              radius: radius
            }
          },
          maxResultCount: 20
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.types,places.id'
          }
        }
      );
      
      const places = textSearchResponse.data.places || [];
      const restaurants = processRestaurants(places, latitude, longitude);
      
      return res.json({ restaurants, searchType: 'text' });
    }
    
    // To get better geographic distribution, we'll search from multiple center points
    // This works around Google's tendency to only return nearby popular restaurants
    const searchCenters = [];
    
    if (radius <= 8047) {
      // 5 miles or less - just search from user location
      searchCenters.push({ lat: latitude, lng: longitude, name: 'center' });
    } else if (radius <= 16093) {
      // 5-10 miles - add 4 points in cardinal directions
      const offset = radius * 0.4; // 40% of radius out
      const latOffset = offset / 111320; // degrees
      const lngOffset = offset / (111320 * Math.cos(latitude * Math.PI / 180));
      
      searchCenters.push(
        { lat: latitude, lng: longitude, name: 'center' },
        { lat: latitude + latOffset, lng: longitude, name: 'north' },
        { lat: latitude - latOffset, lng: longitude, name: 'south' },
        { lat: latitude, lng: longitude + lngOffset, name: 'east' },
        { lat: latitude, lng: longitude - lngOffset, name: 'west' }
      );
    } else {
      // 10+ miles - add 8 points (cardinal + diagonal)
      const offset = radius * 0.5; // 50% of radius out
      const latOffset = offset / 111320;
      const lngOffset = offset / (111320 * Math.cos(latitude * Math.PI / 180));
      const diagOffset = offset * 0.7071; // 45-degree offset
      const diagLatOffset = diagOffset / 111320;
      const diagLngOffset = diagOffset / (111320 * Math.cos(latitude * Math.PI / 180));
      
      searchCenters.push(
        { lat: latitude, lng: longitude, name: 'center' },
        { lat: latitude + latOffset, lng: longitude, name: 'north' },
        { lat: latitude - latOffset, lng: longitude, name: 'south' },
        { lat: latitude, lng: longitude + lngOffset, name: 'east' },
        { lat: latitude, lng: longitude - lngOffset, name: 'west' },
        { lat: latitude + diagLatOffset, lng: longitude + diagLngOffset, name: 'northeast' },
        { lat: latitude + diagLatOffset, lng: longitude - diagLngOffset, name: 'northwest' },
        { lat: latitude - diagLatOffset, lng: longitude + diagLngOffset, name: 'southeast' },
        { lat: latitude - diagLatOffset, lng: longitude - diagLngOffset, name: 'southwest' }
      );
    }
    
    console.log(`[MULTI-POINT] Using ${searchCenters.length} search centers for ${(radius / 1609.34).toFixed(1)} mile radius`);
    
    // Split into MORE search groups to get better geographic coverage
    // Each group maxes at 20, so more groups = more diverse results
    const searchGroups = [
      {
        name: 'Steakhouses & BBQ',
        types: ['steak_house', 'barbecue_restaurant']
      },
      {
        name: 'Seafood & Brazilian',
        types: ['seafood_restaurant', 'brazilian_restaurant']
      },
      {
        name: 'Mediterranean & Greek',
        types: ['mediterranean_restaurant', 'greek_restaurant', 'middle_eastern_restaurant']
      },
      {
        name: 'Mexican & Latin',
        types: ['mexican_restaurant', 'spanish_restaurant']
      },
      {
        name: 'Asian - Japanese & Chinese',
        types: ['japanese_restaurant', 'chinese_restaurant', 'sushi_restaurant']
      },
      {
        name: 'Asian - Thai, Indian, Vietnamese',
        types: ['thai_restaurant', 'indian_restaurant', 'vietnamese_restaurant', 'korean_restaurant']
      },
      {
        name: 'Italian & American',
        types: ['italian_restaurant', 'american_restaurant']
      },
      {
        name: 'Casual Dining',
        types: ['hamburger_restaurant', 'sandwich_shop', 'fast_food_restaurant', 'bar']
      }
    ];
    
    
    const allPlaces = new Map(); // Use Map to deduplicate by ID
    
    // Execute searches from all center points and all group types
    const searchPromises = [];
    
    for (const center of searchCenters) {
      for (const group of searchGroups) {
        searchPromises.push(
          (async () => {
            try {
              const searchRadius = radius / searchCenters.length; // Smaller radius per search point
              
              if (searchCenters.length === 1) {
                console.log(`[SEARCH] ${group.name} (types: ${group.types.join(', ')})`);
              } else {
                console.log(`[SEARCH] ${group.name} from ${center.name} point`);
              }
              
              const response = await axios.post(
                'https://places.googleapis.com/v1/places:searchNearby',
                {
                  includedTypes: group.types,
                  maxResultCount: 10,  // Fewer per search since we're doing more searches
                  // Removed rankPreference: 'DISTANCE' to get better geographic spread
                  locationRestriction: {
                    circle: {
                      center: {
                        latitude: center.lat,
                        longitude: center.lng
                      },
                      radius: searchRadius
                    }
                  }
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.types,places.id'
                  }
                }
              );
              
              const places = response.data.places || [];
              console.log(`[SEARCH] ${group.name} from ${center.name} returned ${places.length} places`);
              
              // Add to map (automatically deduplicates by ID)
              places.forEach(place => {
                if (place.id && !allPlaces.has(place.id)) {
                  allPlaces.set(place.id, place);
                }
              });
              
            } catch (error) {
              console.error(`[ERROR] ${group.name} from ${center.name} search failed:`, error.message);
            }
          })()
        );
      }
    }
    
    // Wait for all searches to complete
    await Promise.all(searchPromises);
    
    
    const uniquePlaces = Array.from(allPlaces.values());
    const restaurants = processRestaurants(uniquePlaces, latitude, longitude);
    
    // Log distance range to diagnose the radius issue
    if (restaurants.length > 0) {
      const distances = restaurants.map(r => parseFloat(r.distance)).sort((a, b) => a - b);
      const minDist = distances[0].toFixed(1);
      const maxDist = distances[distances.length - 1].toFixed(1);
      console.log(`[DISTANCE RANGE] ${minDist} - ${maxDist} miles (searched ${(radius / 1609.34).toFixed(1)} mile radius)`);
    }
    
    console.log(`[SEARCH COMPLETE] Returning ${restaurants.length} restaurants to frontend`);
    
    res.json({ restaurants, searchType: 'nearby-multi' });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Helper function to process restaurant data
function processRestaurants(places, userLat, userLon) {
  console.log(`[DEBUG] Processing ${places.length} places from Google`);
  
  const restaurants = places.map((place, index) => {
    const name = place.displayName?.text || 'Unknown';
    const types = place.types || [];
    const cuisine = getCuisineType(types, name);
    
    // Debug log for first few restaurants
    if (index < 5) {
      console.log(`[DEBUG] Restaurant: ${name}`);
      console.log(`[DEBUG]   Types: ${types.join(', ')}`);
      console.log(`[DEBUG]   Detected cuisine: ${cuisine}`);
    }
    
    return {
      id: place.id,
      name: name,
      address: place.formattedAddress || 'Address not available',
      rating: place.rating || 4.0,
      priceLevel: place.priceLevel ? getPriceLevel(place.priceLevel) : 2,
      cuisine: cuisine,
      distance: calculateDistance(userLat, userLon, 
        place.location.latitude, 
        place.location.longitude),
      lat: place.location.latitude,
      lng: place.location.longitude,
      ketoScore: calculateKetoScore(place),
      diningOptions: getDiningOptions(place),
      isChain: detectChain(name) !== null
    };
  });

  // Sort: known chains first, then by keto score, then by distance
  const filtered = restaurants.filter(r => r.ketoScore >= 0.2);  // Keep minimum keto score
  
  // Log cuisine breakdown for debugging
  const cuisineCounts = {};
  filtered.forEach(r => {
    cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1;
  });
  console.log(`[DEBUG] After filtering (${filtered.length} restaurants):`);
  console.log(`[DEBUG] Cuisine breakdown:`, cuisineCounts);
  
  return filtered.sort((a, b) => {
      // Prioritize known chains
      if (a.isChain && !b.isChain) return -1;
      if (!a.isChain && b.isChain) return 1;
      
      // Then sort by keto score
      if (Math.abs(a.ketoScore - b.ketoScore) > 0.1) {
        return b.ketoScore - a.ketoScore;
      }
      
      // Finally by distance
      return parseFloat(a.distance) - parseFloat(b.distance);
    });
}

// Submit review (requires auth)
app.post('/api/submit-review', requireAuth, async (req, res) => {
  try {
    
    if (!saveReview) {
      console.error('[ERROR] ERROR: saveReview function is not available!');
      return res.status(500).json({ 
        error: 'Database not initialized. The database module failed to load - check server logs.',
        hint: 'Make sure DATABASE_URL is set in Railway variables'
      });
    }
    
    const { restaurantId, restaurantName, rating, ketoRating, comment, menuItems, userName } = req.body;
    
    const review = await saveReview({
      restaurantId,
      restaurantName,
      userName: userName || 'Anonymous',
      rating,
      ketoRating,
      comment,
      menuItems,
      userId: req.userId  // User ID from Clerk token
    });
    
    console.log('[OK] Review saved successfully! Review ID:', review.id, 'User ID:', review.user_id);
    res.json({ success: true, message: 'Review submitted successfully!', review });
  } catch (error) {
    console.error('[ERROR] Error submitting review:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to submit review', 
      details: error.message 
    });
  }
});

// Get reviews for a restaurant (public - no auth required)
app.get('/api/reviews/:restaurantId', async (req, res) => {
  try {
    if (!getReviews) {
      return res.status(500).json({ 
        error: 'Database not initialized',
        reviews: [],
        ketoItems: []
      });
    }
    
    const reviews = await getReviews(req.params.restaurantId);
    
    const ketoItemsSet = new Set();
    reviews.forEach(review => {
      if (review.menu_items) {
        review.menu_items.split(',').forEach(item => {
          const cleaned = item.trim();
          if (cleaned) {
            ketoItemsSet.add(cleaned);
          }
        });
      }
    });
    
    res.json({ 
      reviews,
      ketoItems: Array.from(ketoItemsSet),
      reviewCount: reviews.length
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews', reviews: [], ketoItems: [] });
  }
});

// Get stored NLP signals for a restaurant (public)
app.get('/api/restaurant-signals/:restaurantId', async (req, res) => {
  try {
    if (!getRestaurantSignals) {
      return res.status(500).json({
        error: 'Database not initialized',
        signals: null
      });
    }

    const restaurantId = req.params.restaurantId;
    const signals = await getRestaurantSignals(restaurantId);

    res.json({
      restaurantId,
      signals
    });
  } catch (error) {
    console.error('Error fetching restaurant signals:', error);
    res.status(500).json({
      error: 'Failed to fetch restaurant signals',
      signals: null
    });
  }
});

// Save restaurant signals (requires auth)
app.post('/api/restaurant-signals/:restaurantId', requireAuth, async (req, res) => {
  try {
    if (!upsertRestaurantSignals) {
      return res.status(500).json({
        error: 'Database not initialized'
      });
    }

    const restaurantId = req.params.restaurantId;
    const signals = req.body;

    const saved = await upsertRestaurantSignals(restaurantId, signals);

    res.json({
      success: true,
      saved
    });
  } catch (error) {
    console.error('Error saving restaurant signals:', error);
    res.status(500).json({
      error: 'Failed to save restaurant signals'
    });
  }
});

// Get current user's reviews - REQUIRES AUTH
app.get('/api/my-reviews', requireAuth, async (req, res) => {
  try {
    if (!getUserReviews) {
      return res.status(500).json({ error: 'Database not initialized', reviews: [] });
    }
    
    const reviews = await getUserReviews(req.userId);
    console.log(`[OK] Fetched ${reviews.length} reviews for user ${req.userId}`);
    
    res.json({ reviews, reviewCount: reviews.length });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ error: 'Failed to fetch your reviews', reviews: [] });
  }
});

// Delete a review - REQUIRES AUTH
app.delete('/api/reviews/:reviewId', requireAuth, async (req, res) => {
  try {
    if (!deleteReview) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    const deleted = await deleteReview(req.params.reviewId, req.userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
    }
    
    console.log(`[OK] Review ${req.params.reviewId} deleted by user ${req.userId}`);
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Update a review - REQUIRES AUTH
app.put('/api/reviews/:reviewId', requireAuth, async (req, res) => {
  try {
    if (!updateReview) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    const { rating, ketoRating, comment, menuItems } = req.body;
    
    const updated = await updateReview(req.params.reviewId, req.userId, {
      rating,
      ketoRating,
      comment,
      menuItems
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to edit it' });
    }
    
    console.log(`[OK] Review ${req.params.reviewId} updated by user ${req.userId}`);
    res.json({ success: true, message: 'Review updated successfully', review: updated });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Get AI-suggested keto items for a restaurant
app.post('/api/ai-suggestions', async (req, res) => {
  try {
    const { restaurantName, cuisine } = req.body;
    
    if (!openai) {
      const fallbackSuggestions = getBasicKetoSuggestions(cuisine);
      return res.json({ 
        suggestions: fallbackSuggestions,
        isAI: false,
        message: 'Basic suggestions (AI not configured)'
      });
    }
    
    const prompt = `You are a keto diet expert. For the restaurant "${restaurantName}" which serves ${cuisine} cuisine, suggest 4-5 specific menu items that are likely to be keto-friendly (low carb, high fat/protein).

Rules:
- Be specific to the cuisine type
- Include modifications if needed (e.g., "without the bun", "no rice")
- Keep each item name short (2-5 words)
- Only suggest realistic items for this cuisine type

Respond with ONLY a JSON array of strings, nothing else. Example: ["Grilled Ribeye Steak", "Caesar Salad (no croutons)", "SautÃƒÂ©ed Spinach"]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7
    });
    
    const responseText = completion.choices[0].message.content.trim();
    
    let suggestions;
    try {
      suggestions = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      suggestions = getBasicKetoSuggestions(cuisine);
    }
    
    res.json({ 
      suggestions,
      isAI: true,
      message: 'AI-generated suggestions'
    });
    
  } catch (error) {
    console.error('Error getting AI suggestions:', error.message);
    const { cuisine } = req.body;
    res.json({ 
      suggestions: getBasicKetoSuggestions(cuisine),
      isAI: false,
      message: 'Fallback suggestions (AI error)'
    });
  }
});

// Analyze Google reviews with keyword-based signal extraction
app.post('/api/analyze-google-reviews/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { restaurantName } = req.body || {};

    // Short-circuit: known chains have verified nutrition   no need to guess from reviews
    if (restaurantName) {
      const chainInfo = detectChain(restaurantName);
      if (chainInfo) {
        const menuKey = getChainMenuKey(chainInfo);
        const menuData = chainMenuData[menuKey];
        if (menuData && menuData.combos && menuData.combos.length > 0) {
          const bestItem = [...menuData.combos].sort((a, b) => a.carbs - b.carbs)[0];
          const lowCarbCount = menuData.combos.filter(c => c.carbs <= 5).length;
          const summary = `Verified: ${menuData.combos.length} keto options from ${chainInfo.name} (${lowCarbCount} under 5g carbs). Best: ${bestItem.name}   ${bestItem.carbs}g carbs, ${bestItem.protein}g protein`;

          const saved = await upsertRestaurantSignals(restaurantId, {
            ketoConfidence: 1.0,
            reasons: summary
          });

          console.log(`[OK] Chain short-circuit for ${chainInfo.name}   skipping Google review scan`);

          return res.json({
            success: true,
            reviewCount: 0,
            signals: {},
            ketoConfidence: 1.0,
            summary: summary,
            foundKetoFoods: menuData.combos.map(c => c.name).slice(0, 8),
            foundCustomizations: menuData.orderTips || [],
            foundCookingMethods: [],
            saved: saved,
            isVerifiedChain: true
          });
        }
      }
    }

    // Fetch Google reviews
    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${restaurantId}`,
      {
        headers: {
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'reviews.text.text'
        }
      }
    );

    const reviews = response.data.reviews || [];
    const reviewCount = reviews.length;

    let totals = {
      ketoMentions: 0,
      customizationMentions: 0,
      accommodatingMentions: 0,
      ketoFoodMentions: 0,
      healthyCookingMentions: 0,
      dietaryMentions: 0,
      portionMentions: 0,
      hiddenCarbMentions: 0,
      highCarbMentions: 0,
    };

    const allFoundKetoFoods = new Set();
    const allFoundCustomizations = new Set();
    const allFoundCookingMethods = new Set();

    reviews.forEach(r => {
      if (!r.text?.text) return;
      const result = analyzeReviewText(r.text.text);

      Object.keys(totals).forEach(key => {
        totals[key] += result[key] || 0;
      });

      if (result.foundKetoFoods) {
        result.foundKetoFoods.forEach(item => allFoundKetoFoods.add(item));
      }
      if (result.foundCustomizations) {
        result.foundCustomizations.forEach(item => allFoundCustomizations.add(item));
      }
      if (result.foundCookingMethods) {
        result.foundCookingMethods.forEach(item => allFoundCookingMethods.add(item));
      }
    });

    const foundKetoFoods = Array.from(allFoundKetoFoods).slice(0, 8);
    const foundCustomizations = Array.from(allFoundCustomizations).slice(0, 6);
    const foundCookingMethods = Array.from(allFoundCookingMethods).slice(0, 4);

    const ketoConfidence = calculateKetoConfidence(totals, reviewCount);
    const summary = generateSignalsSummary(totals, ketoConfidence);

    const saved = await upsertRestaurantSignals(restaurantId, {
      ...totals,
      ketoConfidence,
      reasons: summary
    });

    res.json({
      success: true,
      reviewCount: reviewCount,
      signals: totals,
      ketoConfidence: ketoConfidence,
      summary: summary,
      foundKetoFoods: foundKetoFoods,
      foundCustomizations: foundCustomizations,
      foundCookingMethods: foundCookingMethods,
      saved: saved
    });

  } catch (error) {
    console.error('Google review analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze Google reviews',
      details: error.message 
    });
  }
});
// Basic keto suggestions by cuisine (fallback when AI is unavailable)
function getBasicKetoSuggestions(cuisine) {
  const suggestions = {
    'Steakhouse': ['Ribeye Steak', 'Filet Mignon', 'Caesar Salad (no croutons)', 'Grilled Asparagus'],
    'Seafood': ['Grilled Salmon', 'Shrimp Scampi (no pasta)', 'Lobster Tail', 'Steamed Crab Legs'],
    'BBQ': ['Smoked Brisket (no sauce)', 'Pulled Pork (no bun)', 'Dry Rub Ribs', 'Smoked Wings'],
    'Mexican': ['Carne Asada', 'Fajitas (no tortilla)', 'Carnitas Bowl (no rice)', 'Guacamole & Pork Rinds'],
    'Mediterranean': ['Greek Salad', 'Lamb Chops', 'Grilled Chicken Souvlaki', 'Tzatziki with Veggies'],
    'Greek': ['Greek Salad', 'Lamb Chops', 'Grilled Chicken Souvlaki', 'Tzatziki with Veggies'],
    'Italian': ['Chicken Piccata (no pasta)', 'Antipasto Platter', 'Grilled Branzino', 'Caprese Salad'],
    'American': ['Bunless Burger', 'Grilled Chicken Breast', 'Cobb Salad', 'Buffalo Wings'],
    'Japanese': ['Sashimi Platter', 'Beef Negimaki', 'Edamame', 'Grilled Salmon Teriyaki (no rice)'],
    'Chinese': ['Steamed Fish', 'Beef & Broccoli (no rice)', 'Egg Drop Soup', 'Peking Duck (no pancakes)'],
    'Indian': ['Tandoori Chicken', 'Lamb Seekh Kebab', 'Paneer Tikka', 'Saag (no naan)'],
    'Thai': ['Larb (meat salad)', 'Tom Yum Soup', 'Grilled Satay', 'Green Curry (no rice)'],
    'Brazilian': ['Picanha', 'Grilled Chicken Hearts', 'Bacon-Wrapped Filet', 'Mixed Grilled Meats']
  };
  
  return suggestions[cuisine] || ['Grilled Protein', 'House Salad (no croutons)', 'Steamed Vegetables', 'Bunless Burger'];
}

// Get verified menu data for a chain restaurant
app.get('/api/chain-menu/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { restaurantName } = req.query;
    
    if (!restaurantName) {
      return res.json({ isChain: false, items: [] });
    }
    
    // Check if it's a known chain
    const chainInfo = detectChain(restaurantName);
    
    if (!chainInfo) {
      return res.json({ isChain: false, items: [] });
    }
    
    
    // Use curated nutrition data if available
    const manualData = chainMenuData[getChainMenuKey(chainInfo)];
    
    if (manualData && manualData.combos && manualData.combos.length > 0) {
      
      return res.json({
        isChain: true,
        chainName: chainInfo.name,
        items: manualData.combos,
        orderTips: manualData.orderTips || [],
        source: manualData.source,
        message: `${manualData.combos.length} verified keto options (official nutrition)`
      });
    }
    
    // FALLBACK: Query API Ninjas for chains without manual data
    const ketoItems = [];
    
    for (const item of chainInfo.ketoQueries) {
      try {
        const response = await axios.get(
          `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(item)}`,
          {
            headers: {
              'X-Api-Key': process.env.API_NINJAS_KEY
            }
          }
        );
        
        if (response.data && response.data.length > 0) {
          const itemData = response.data[0];
          const carbs = itemData.carbohydrates_total_g || 0;
          
          // Only include if reasonably low carb (< 20g)
          if (carbs < 20) {
            ketoItems.push({
              name: item,
              carbs: Math.round(carbs * 10) / 10,
              protein: Math.round((itemData.protein_g || 0) * 10) / 10,
              fat: Math.round((itemData.fat_total_g || 0) * 10) / 10,
              calories: Math.round(itemData.calories || 0),
              verified: true
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching ${item}:`, error.message);
      }
    }
    
    res.json({
      isChain: true,
      chainName: chainInfo.name,
      items: ketoItems,
      message: ketoItems.length > 0 
        ? `Found ${ketoItems.length} verified keto options` 
        : 'No verified keto items found'
    });
    
  } catch (error) {
    console.error('Chain menu error:', error.message);
    res.status(500).json({ error: 'Failed to fetch chain menu data', isChain: false, items: [] });
  }
});

function detectChain(restaurantName) {
  const name = restaurantName.toLowerCase();
  for (const [key, chain] of Object.entries(CHAIN_REGISTRY)) {
    if (name.includes(key)) {
      return chain;
    }
  }
  return null;
}

function analyzeReviewText(text) {
  const t = text.toLowerCase();

  const countMatches = (phrases) => phrases.filter(phrase => t.includes(phrase)).length;
  const getMatches = (phrases) => phrases.filter(phrase => t.includes(phrase));

  // KETO-SPECIFIC MENTIONS (strongest signal)
  const ketoKeywords = ['keto', 'ketogenic', 'low carb', 'low-carb', 'lchf', 'paleo'];
  const ketoMentions = countMatches(ketoKeywords);

  // CUSTOMIZATION OPTIONS (very strong signal)
  const customizationKeywords = [
    'lettuce wrap', 'lettuce wrapped', 'protein style',
    'bunless', 'without the bun', 'skip the bun',
    'cauliflower rice', 'cauli rice',
    'no bread', 'without bread', 'skip the bread',
    'no tortilla', 'no wrap',
    'bowl instead', 'make it a bowl',
    'substitute', 'substitution', 'swap',
    'no pasta', 'no noodles', 'no rice',
    'no bun', 'without bun',
    'no ketchup', 'no sauce',
    'instead of', 'made it without', 'hold the', 'remove the',
    'can i get', 'can you make'
  ];
  const customizationMentions = countMatches(customizationKeywords);

  // ACCOMMODATING SERVICE (strong positive signal)
  const accommodatingKeywords = [
    'accommodating', 'accommodated',
    'willing to', 'happy to modify', 'no problem',
    'very flexible', 'flexible with',
    'made it without', 'left off', 'held the',
    'custom', 'customize', 'modification'
  ];
  const accommodatingMentions = countMatches(accommodatingKeywords);

  // KETO-FRIENDLY FOODS (good signal)
  const ketoFoodKeywords = [
    'avocado', 'bacon', 'egg', 'eggs',
    'steak', 'ribeye', 'sirloin', 'filet',
    'salmon', 'fish', 'seafood', 'shrimp',
    'chicken breast', 'grilled chicken',
    'bunless burger', 'burger bowl', 'protein bowl',
    'salad', 'greens', 'vegetables', 'veggies',
    'cheese', 'butter', 'olive oil',
    'wings', 'drumstick'
  ];
  const ketoFoodMentions = countMatches(ketoFoodKeywords);

  // COOKING METHODS (positive signal)
  const healthyCookingKeywords = [
    'grilled', 'baked', 'roasted', 'steamed',
    'sautÃƒÂ©ed', 'sauteed', 'pan-seared', 'broiled'
  ];
  const healthyCookingMentions = countMatches(healthyCookingKeywords);

  // DIETARY AWARENESS (moderate positive signal)
  const dietaryKeywords = [
    'gluten free', 'gluten-free', 'dairy free', 'sugar free',
    'diet friendly', 'dietary restrictions', 'dietary needs',
    'nutrition', 'macros', 'calories', 'carbs'
  ];
  const dietaryMentions = countMatches(dietaryKeywords);

  // HIDDEN CARB RISKS (warning signals)
  const hiddenCarbKeywords = [
    'breaded', 'battered', 'fried coating',
    'sweet sauce', 'teriyaki', 'bbq sauce', 'honey',
    'glazed', 'candied', 'sweetened',
    'flour tortilla', 'corn tortilla'
  ];
  const hiddenCarbMentions = countMatches(hiddenCarbKeywords);

  // HIGH CARB FOODS (negative signals)
  const highCarbKeywords = [
    'pasta', 'noodles', 'rice', 'bread', 'bun',
    'potato', 'fries', 'chips',
    'pizza', 'dough',
    'dessert', 'cake', 'cookie', 'pastry',
    'pancake', 'waffle', 'toast'
  ];
  const highCarbMentions = countMatches(highCarbKeywords);

  // PORTION/VALUE (good for keto - bigger portions = better)
  const portionKeywords = [
    'huge portion', 'large portion', 'generous portion',
    'filling', 'substantial', 'plenty of protein'
  ];
  const portionMentions = countMatches(portionKeywords);

  return {
    // Core signals
    ketoMentions,
    customizationMentions,
    accommodatingMentions,
    
    // Additional positive signals
    ketoFoodMentions,
    healthyCookingMentions,
    dietaryMentions,
    portionMentions,
    
    // Warning signals
    hiddenCarbMentions,
    highCarbMentions,
    
    // Track which items were actually found
    foundKetoFoods: getMatches(ketoFoodKeywords),
    foundCustomizations: getMatches(customizationKeywords),
    foundCookingMethods: getMatches(healthyCookingKeywords),
  };
}

// Calculate weighted keto confidence score
function calculateKetoConfidence(signals, reviewCount) {
  // If no reviews, return null
  if (reviewCount === 0) return null;

  // Weight different signal types
  const weights = {
    ketoMentions: 3.0,           // Strongest signal
    customizationMentions: 2.5,   // Very strong
    accommodatingMentions: 2.0,   // Strong
    ketoFoodMentions: 1.0,        // Good
    healthyCookingMentions: 0.8,  // Moderate
    dietaryMentions: 0.7,         // Moderate
    portionMentions: 0.5,         // Slight boost
    hiddenCarbMentions: -1.5,     // Warning
    highCarbMentions: -0.8        // Slight negative
  };

  // Calculate weighted score
  let score = 0;
  let maxPossibleScore = 0;

  Object.entries(weights).forEach(([key, weight]) => {
    const mentions = signals[key] || 0;
    score += mentions * weight;
    
    // For positive weights, add to max possible (normalize later)
    if (weight > 0) {
      maxPossibleScore += Math.abs(weight) * 3; // Assume max 3 mentions per category
    }
  });

  // Normalize to 0-1 range with adjustment for review count
  let confidence = score / maxPossibleScore;
  
  // Boost confidence if we have more reviews (more data = more reliable)
  const reviewBoost = Math.min(reviewCount / 20, 0.2); // Up to +0.2 for 20+ reviews
  confidence += reviewBoost;

  // Clamp to 0-1 range
  confidence = Math.max(0, Math.min(1, confidence));

  return confidence;
}

// Generate human-readable summary of signals
function generateSignalsSummary(signals, confidence) {
  const summary = [];
  
  if (signals.ketoMentions > 0) {
    summary.push(`${signals.ketoMentions} keto/low-carb mention${signals.ketoMentions > 1 ? 's' : ''}`);
  }
  
  if (signals.customizationMentions > 0) {
    summary.push(`${signals.customizationMentions} customization option${signals.customizationMentions > 1 ? 's' : ''}`);
  }
  
  if (signals.accommodatingMentions > 0) {
    summary.push(`${signals.accommodatingMentions} mention${signals.accommodatingMentions > 1 ? 's' : ''} of accommodating service`);
  }
  
  if (signals.ketoFoodMentions > 3) {
    summary.push(`${signals.ketoFoodMentions} keto-friendly foods mentioned`);
  }
  
  if (signals.hiddenCarbMentions > 0) {
    summary.push(`[WARN] ${signals.hiddenCarbMentions} warning${signals.hiddenCarbMentions > 1 ? 's' : ''} about hidden carbs`);
  }
  
  if (summary.length === 0) {
    return 'No specific keto signals found in reviews';
  }
  
  return summary.join(' • ');
}

// Helper functions
function getPriceLevel(priceLevel) {
  const mapping = {
    'PRICE_LEVEL_FREE': 1,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4
  };
  return mapping[priceLevel] || 2;
}

// Score a known chain based on its actual verified menu nutrition
function calculateChainKetoScore(menuData) {
  const combos = menuData.combos;
  const lowCarbCount = combos.filter(c => c.carbs <= 5).length;
  const avgCarbs = combos.reduce((sum, c) => sum + c.carbs, 0) / combos.length;
  const hasZeroCarb = combos.some(c => c.carbs === 0);

  // Count items that require modifications (bunless, no bun, no bread, etc.)
  const modificationKeywords = ['no bun', 'bunless', 'no bread', 'no biscuit', 'no croissant', 
                                'no muffin', 'no tortilla', 'no rice', 'protein style', 'lettuce wrap'];
  const itemsRequiringMods = combos.filter(c => {
    const orderAs = (c.orderAs || '').toLowerCase();
    const itemName = (c.name || '').toLowerCase();
    return modificationKeywords.some(keyword => orderAs.includes(keyword) || itemName.includes(keyword));
  }).length;
  
  const customizationRatio = itemsRequiringMods / combos.length;

  // ketoNaturalness reflects how naturally keto-friendly the restaurant's core menu is.
  // A steakhouse scores high because steaks ARE the menu (0.95).
  // A burger joint scores medium because you have to order bunless (0.65).
  // A donut shop scores low because nothing is keto without heavy modification (0.3).
  const naturalness = menuData.ketoNaturalness || 0.70;

  // Make naturalness the PRIMARY factor (0.35 to 0.70 range)
  let score = 0.35 + (naturalness * 0.35);
  
  // Penalty for high customization ratio (-0.15 max)
  score -= (customizationRatio * 0.15);
  
  // Bonus for many low-carb options (up to +0.15)
  score += (lowCarbCount / combos.length) * 0.15;
  
  // Bonus for low average carbs (up to +0.08)
  score += Math.max(0, (12 - avgCarbs) / 12) * 0.08;
  
  // Small bonus for zero-carb options
  if (hasZeroCarb) score += 0.02;

  // Cap at 0.95 for chains (always have some non-keto items)
  return Math.min(0.95, Math.max(0.30, Math.round(score * 100) / 100));
}
function calculateKetoScore(place) {
  const name = place.displayName?.text || '';

  // Known chain with verified menu data? Score from actual nutrition, not guesswork.
  const chainInfo = detectChain(name);
  if (chainInfo) {
    const menuKey = getChainMenuKey(chainInfo);
    const menuData = chainMenuData[menuKey];
    if (menuData && menuData.combos && menuData.combos.length > 0) {
      return calculateChainKetoScore(menuData);
    }
  }

  // Fallback: estimate from restaurant name and Google type keywords
  let score = 0.6;
  const nameLower = name.toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();

  if (nameLower.includes('grill') || nameLower.includes('grille')) score += 0.2;
  if (nameLower.includes('steak') || nameLower.includes('steakhouse')) score += 0.3;
  if (nameLower.includes('bbq') || nameLower.includes('barbecue') || nameLower.includes('smokehouse')) score += 0.25;
  if (nameLower.includes('seafood') || nameLower.includes('fish')) score += 0.2;
  if (nameLower.includes('meat') || nameLower.includes('butcher')) score += 0.2;
  if (nameLower.includes('salad')) score += 0.15;
  if (nameLower.includes('protein') || nameLower.includes('fit') || nameLower.includes('healthy')) score += 0.2;

  if (types.includes('steak_house')) score += 0.3;
  if (types.includes('seafood_restaurant')) score += 0.25;
  if (types.includes('barbecue_restaurant')) score += 0.25;
  if (types.includes('brazilian_restaurant')) score += 0.2;
  if (types.includes('mediterranean_restaurant')) score += 0.15;
  if (types.includes('greek_restaurant')) score += 0.15;

  if (nameLower.includes('pizza')) score -= 0.4;
  if (nameLower.includes('pasta') || nameLower.includes('noodle')) score -= 0.35;
  if (nameLower.includes('bakery') || nameLower.includes('bread')) score -= 0.4;
  if (nameLower.includes('donut') || nameLower.includes('doughnut')) score -= 0.5;
  if (nameLower.includes('ice cream') || nameLower.includes('frozen yogurt')) score -= 0.4;
  if (nameLower.includes('pancake') || nameLower.includes('waffle')) score -= 0.4;
  if (nameLower.includes('buffet')) score -= 0.2;
  if (nameLower.includes('casino')) score -= 0.3;
  if (nameLower.includes('cafe') && !nameLower.includes('grill')) score -= 0.1;

  if (types.includes('bakery')) score -= 0.35;
  if (types.includes('dessert_shop')) score -= 0.3;
  if (types.includes('ice_cream_shop')) score -= 0.4;
  if (types.includes('pizza_restaurant')) score -= 0.35;
  if (types.includes('fast_food_restaurant')) score -= 0.05;

  return Math.max(0.2, Math.min(1.0, score));
}

function getCuisineType(types, name = '') {
  const nameLower = name.toLowerCase();
  
  // First, check restaurant name for cuisine keywords
  // This catches places like "Cava" (Mediterranean) even if Google tags them generically
  const nameKeywords = {
    'Mediterranean': ['mediterranean', 'cava', 'hummus', 'falafel', 'shawarma', 'pita', 'tzatziki'],
    'Greek': ['greek', 'gyro', 'souvlaki', 'moussaka'],
    'Mexican': ['mexican', 'taco', 'burrito', 'chipotle', 'qdoba', 'taqueria', 'cantina'],
    'Italian': ['italian', 'pizza', 'pasta', 'trattoria', 'pizzeria', 'ristorante'],
    'Chinese': ['chinese', 'wok', 'panda', 'dynasty', 'mandarin'],
    'Japanese': ['japanese', 'sushi', 'ramen', 'hibachi', 'teriyaki'],
    'Thai': ['thai', 'pad thai', 'curry'],
    'Indian': ['indian', 'tandoori', 'curry', 'biryani', 'masala'],
    'BBQ': ['bbq', 'barbecue', 'smokehouse', 'brisket', 'ribs'],
    'Steakhouse': ['steakhouse', 'steak house', 'chophouse', 'prime'],
    'Seafood': ['seafood', 'fish', 'lobster', 'oyster', 'crab shack'],
    'Brazilian': ['brazilian', 'churrascaria', 'gaucho'],
    'Vietnamese': ['vietnamese', 'pho', 'banh mi'],
    'Korean': ['korean', 'bbq', 'kimchi'],
    'Middle Eastern': ['middle eastern', 'kebab', 'shawarma', 'falafel']
  };
  
  // Check name for cuisine keywords
  for (const [cuisine, keywords] of Object.entries(nameKeywords)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return cuisine;
      }
    }
  }
  
  // Then check Google's type tags
  const cuisineMap = {
    'steak_house': 'Steakhouse',
    'seafood_restaurant': 'Seafood',
    'mexican_restaurant': 'Mexican',
    'mediterranean_restaurant': 'Mediterranean',
    'greek_restaurant': 'Greek',
    'american_restaurant': 'American',
    'italian_restaurant': 'Italian',
    'japanese_restaurant': 'Japanese',
    'chinese_restaurant': 'Chinese',
    'indian_restaurant': 'Indian',
    'thai_restaurant': 'Thai',
    'barbecue_restaurant': 'BBQ',
    'brazilian_restaurant': 'Brazilian',
    'vietnamese_restaurant': 'Vietnamese',
    'korean_restaurant': 'Korean',
    'middle_eastern_restaurant': 'Middle Eastern',
    'bar': 'Bar & Grill',
    'sports_bar': 'Sports Bar',
    'fast_food_restaurant': 'Fast Food',
    'sandwich_shop': 'Sandwiches',
    'hamburger_restaurant': 'Burgers'
  };
  
  for (const type of types) {
    if (cuisineMap[type]) return cuisineMap[type];
  }
  
  // Default to American only if we really can't tell
  return 'American';
}

function getDiningOptions(place) {
  const types = (place.types || []).map(t => t.toLowerCase());
  const name = (place.displayName?.text || '').toLowerCase();
  const options = ['Dine-in', 'Takeout'];

  // Drive-through: explicit type or name signal
  if (types.includes('drive_through') || name.includes('drive-through') || name.includes('drive thru')) {
    options.push('Drive-through');
  }

  // Delivery: fast-food and quick-service chains almost always offer it
  if (types.includes('fast_food_restaurant') || types.includes('meal_takeaway')) {
    options.push('Delivery');
  }

  // Outdoor seating: bars, restaurants with 'garden', 'patio', 'outdoor' in name
  if (types.includes('bar') || types.includes('outdoor_restaurant') ||
      name.includes('patio') || name.includes('garden') || name.includes('outdoor')) {
    options.push('Outdoor Seating');
  }

  return options;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

// Initialize database on startup
if (initDatabase) {
  initDatabase()
    .then(() => console.log('[OK] Database tables initialized'))
    .catch(err => console.error('[ERROR] Database initialization error:', err));
} else {
  console.error('[ERROR] Cannot initialize database - initDatabase function not available');
}

app.listen(PORT, () => {
  console.log(`Keto Hunter API running on port ${PORT}`);
  console.log(`Database status: ${saveReview ? '[OK] Connected' : '[ERROR] Not Connected'}`);
  console.log(`Clerk status: ${clerkClient ? '[OK] Configured' : '[ERROR] Not Configured'}`);
});