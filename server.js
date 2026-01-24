const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

console.log('=== STARTUP DIAGNOSTICS ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('GOOGLE_PLACES_API_KEY exists:', !!process.env.GOOGLE_PLACES_API_KEY);

// Try to load database with error handling
let initDatabase, saveReview, getReviews;
try {
  console.log('Attempting to load database module...');
  const db = require('./database');
  initDatabase = db.initDatabase;
  saveReview = db.saveReview;
  getReviews = db.getReviews;
  console.log('✅ Database module loaded successfully');
} catch (error) {
  console.error('❌ FAILED TO LOAD DATABASE MODULE:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Keto Hunter API is running!',
    database: !!saveReview ? 'connected' : 'NOT CONNECTED - check logs',
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
    const { latitude, longitude, radius = 8000 } = req.body;
    
    // Keto-friendly restaurant types to search for
    const ketoFriendlyTypes = [
      'steak_house',
      'seafood_restaurant', 
      'american_restaurant',
      'barbecue_restaurant',
      'mediterranean_restaurant',
      'mexican_restaurant',
      'brazilian_restaurant',
      'greek_restaurant'
    ];

    // Search for keto-friendly types specifically
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        includedTypes: ketoFriendlyTypes,
        maxResultCount: 20,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: {
            center: {
              latitude: latitude,
              longitude: longitude
            },
            radius: radius
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
    
    const restaurants = places.map(place => ({
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || 'Address not available',
      rating: place.rating || 4.0,
      priceLevel: place.priceLevel ? getPriceLevel(place.priceLevel) : 2,
      cuisine: getCuisineType(place.types || []),
      distance: calculateDistance(latitude, longitude, 
        place.location.latitude, 
        place.location.longitude),
      ketoScore: calculateKetoScore(place),
      ketoOptions: getKetoOptions(place.types || []),
      diningOptions: getDiningOptions(place),
      ketoReviews: Math.floor(Math.random() * 50) + 10
    }));

    // Filter out low keto scores and sort by score (highest first)
    const ketoFriendly = restaurants
      .filter(r => r.ketoScore >= 0.5)
      .sort((a, b) => b.ketoScore - a.ketoScore);

    res.json({ restaurants: ketoFriendly });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Submit review endpoint
app.post('/api/submit-review', async (req, res) => {
  try {
    console.log('=== REVIEW SUBMISSION STARTED ===');
    console.log('Request body:', req.body);
    
    if (!saveReview) {
      console.error('❌ ERROR: saveReview function is not available!');
      console.error('This means the database module failed to load.');
      console.error('Check the startup logs for "FAILED TO LOAD DATABASE MODULE"');
      return res.status(500).json({ 
        error: 'Database not initialized. The database module failed to load - check server logs.',
        hint: 'Make sure DATABASE_URL is set in Railway variables'
      });
    }
    
    const { restaurantId, restaurantName, rating, ketoRating, comment, menuItems, userName } = req.body;
    
    console.log('Attempting to save review to database...');
    const review = await saveReview({
      restaurantId,
      restaurantName,
      userName: userName || 'Anonymous',
      rating,
      ketoRating,
      comment,
      menuItems
    });
    
    console.log('✅ Review saved successfully! Review ID:', review.id);
    res.json({ success: true, message: 'Review submitted successfully!', review });
  } catch (error) {
    console.error('❌ Error submitting review:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to submit review', 
      details: error.message 
    });
  }
});

// Get reviews for a restaurant
app.get('/api/reviews/:restaurantId', async (req, res) => {
  try {
    if (!getReviews) {
      return res.status(500).json({ 
        error: 'Database not initialized',
        reviews: []
      });
    }
    
    const reviews = await getReviews(req.params.restaurantId);
    res.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews', reviews: [] });
  }
});

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

function calculateKetoScore(place) {
  let score = 0.6; // Start with decent base since we're searching keto-friendly types
  
  const name = (place.displayName?.text || '').toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();
  
  // BOOST: Keto-friendly indicators
  if (name.includes('grill') || name.includes('grille')) score += 0.2;
  if (name.includes('steak') || name.includes('steakhouse')) score += 0.3;
  if (name.includes('bbq') || name.includes('barbecue') || name.includes('smokehouse')) score += 0.25;
  if (name.includes('seafood') || name.includes('fish')) score += 0.2;
  if (name.includes('meat') || name.includes('butcher')) score += 0.2;
  if (name.includes('salad')) score += 0.15;
  if (name.includes('protein') || name.includes('fit') || name.includes('healthy')) score += 0.2;
  
  // Type-based boosts
  if (types.includes('steak_house')) score += 0.3;
  if (types.includes('seafood_restaurant')) score += 0.25;
  if (types.includes('barbecue_restaurant')) score += 0.25;
  if (types.includes('brazilian_restaurant')) score += 0.2; // Churrascarias are great for keto
  if (types.includes('mediterranean_restaurant')) score += 0.15;
  if (types.includes('greek_restaurant')) score += 0.15;
  
  // PENALIZE: Non-keto indicators
  if (name.includes('pizza')) score -= 0.4;
  if (name.includes('pasta') || name.includes('noodle')) score -= 0.35;
  if (name.includes('bakery') || name.includes('bread')) score -= 0.4;
  if (name.includes('donut') || name.includes('doughnut')) score -= 0.5;
  if (name.includes('ice cream') || name.includes('frozen yogurt')) score -= 0.4;
  if (name.includes('pancake') || name.includes('waffle')) score -= 0.4;
  if (name.includes('buffet')) score -= 0.2; // Buffets are mixed
  if (name.includes('casino')) score -= 0.3;
  if (name.includes('cafe') && !name.includes('grill')) score -= 0.1;
  
  // Type-based penalties
  if (types.includes('bakery')) score -= 0.35;
  if (types.includes('dessert_shop')) score -= 0.3;
  if (types.includes('ice_cream_shop')) score -= 0.4;
  if (types.includes('pizza_restaurant')) score -= 0.35;
  if (types.includes('fast_food_restaurant')) score -= 0.15;
  
  // Clamp between 0.2 and 1.0
  return Math.max(0.2, Math.min(1.0, score));
}

function getCuisineType(types) {
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
    'bar': 'Bar & Grill',
    'sports_bar': 'Sports Bar'
  };
  
  for (const type of types) {
    if (cuisineMap[type]) return cuisineMap[type];
  }
  return 'American';
}

function getKetoOptions(types) {
  const typeStr = types.join(' ').toLowerCase();
  
  if (typeStr.includes('steak')) {
    return ['Ribeye Steak', 'Filet Mignon', 'Caesar Salad', 'Grilled Asparagus'];
  }
  if (typeStr.includes('seafood')) {
    return ['Grilled Salmon', 'Shrimp Scampi (no pasta)', 'Lobster Tail', 'Crab Legs'];
  }
  if (typeStr.includes('barbecue')) {
    return ['Smoked Brisket', 'Pulled Pork (no bun)', 'Ribs (dry rub)', 'Smoked Wings'];
  }
  if (typeStr.includes('mexican')) {
    return ['Carne Asada', 'Fajitas (no tortilla)', 'Carnitas Bowl', 'Guacamole'];
  }
  if (typeStr.includes('mediterranean') || typeStr.includes('greek')) {
    return ['Greek Salad', 'Lamb Chops', 'Grilled Chicken', 'Tzatziki'];
  }
  if (typeStr.includes('brazilian')) {
    return ['Picanha', 'Grilled Meats', 'Bacon-Wrapped Chicken', 'Churasco'];
  }
  if (typeStr.includes('japanese')) {
    return ['Sashimi', 'Grilled Fish', 'Beef Negimaki', 'Edamame'];
  }
  
  return ['Grilled Protein', 'House Salad', 'Steamed Vegetables', 'Bunless Burger'];
}

function getDiningOptions(place) {
  // Default options - in a full implementation you'd check place details
  return ['Dine-in', 'Takeout'];
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
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
    .then(() => console.log('✅ Database tables initialized'))
    .catch(err => console.error('❌ Database initialization error:', err));
} else {
  console.error('❌ Cannot initialize database - initDatabase function not available');
}

app.listen(PORT, () => {
  console.log(`🚀 Keto Hunter API running on port ${PORT}`);
  console.log(`Database status: ${saveReview ? '✅ Connected' : '❌ Not Connected'}`);
});