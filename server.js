const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');
const { createClerkClient } = require('@clerk/backend');
require('dotenv').config();

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
  console.log('✅ Clerk client initialized');
} else {
  console.log('⚠️ Clerk secret key not found - auth verification disabled');
}

// Initialize OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI client initialized');
} else {
  console.log('⚠️ OpenAI API key not found - AI suggestions will be disabled');
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
    console.log('✅ Authenticated user:', userId);
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
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
      ketoOptions: [],
      diningOptions: getDiningOptions(place),
      ketoReviews: 0
    }));

    const ketoFriendly = restaurants
      .filter(r => r.ketoScore >= 0.5)
      .sort((a, b) => b.ketoScore - a.ketoScore);

    res.json({ restaurants: ketoFriendly });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Submit review endpoint - NOW REQUIRES AUTH
app.post('/api/submit-review', requireAuth, async (req, res) => {
  try {
    console.log('=== REVIEW SUBMISSION STARTED ===');
    console.log('User ID from token:', req.userId);
    console.log('Request body:', req.body);
    
    if (!saveReview) {
      console.error('❌ ERROR: saveReview function is not available!');
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
      menuItems,
      userId: req.userId  // User ID from Clerk token
    });
    
    console.log('✅ Review saved successfully! Review ID:', review.id, 'User ID:', review.user_id);
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
  } catc


// Get current user's reviews - REQUIRES AUTH
app.get('/api/my-reviews', requireAuth, async (req, res) => {
  try {
    if (!getUserReviews) {
      return res.status(500).json({ error: 'Database not initialized', reviews: [] });
    }
    
    const reviews = await getUserReviews(req.userId);
    console.log(`✅ Fetched ${reviews.length} reviews for user ${req.userId}`);
    
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
    
    console.log(`✅ Review ${req.params.reviewId} deleted by user ${req.userId}`);
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
    
    console.log(`✅ Review ${req.params.reviewId} updated by user ${req.userId}`);
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

Respond with ONLY a JSON array of strings, nothing else. Example: ["Grilled Ribeye Steak", "Caesar Salad (no croutons)", "Sautéed Spinach"]`;

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
  let score = 0.6;
  
  const name = (place.displayName?.text || '').toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();
  
  if (name.includes('grill') || name.includes('grille')) score += 0.2;
  if (name.includes('steak') || name.includes('steakhouse')) score += 0.3;
  if (name.includes('bbq') || name.includes('barbecue') || name.includes('smokehouse')) score += 0.25;
  if (name.includes('seafood') || name.includes('fish')) score += 0.2;
  if (name.includes('meat') || name.includes('butcher')) score += 0.2;
  if (name.includes('salad')) score += 0.15;
  if (name.includes('protein') || name.includes('fit') || name.includes('healthy')) score += 0.2;
  
  if (types.includes('steak_house')) score += 0.3;
  if (types.includes('seafood_restaurant')) score += 0.25;
  if (types.includes('barbecue_restaurant')) score += 0.25;
  if (types.includes('brazilian_restaurant')) score += 0.2;
  if (types.includes('mediterranean_restaurant')) score += 0.15;
  if (types.includes('greek_restaurant')) score += 0.15;
  
  if (name.includes('pizza')) score -= 0.4;
  if (name.includes('pasta') || name.includes('noodle')) score -= 0.35;
  if (name.includes('bakery') || name.includes('bread')) score -= 0.4;
  if (name.includes('donut') || name.includes('doughnut')) score -= 0.5;
  if (name.includes('ice cream') || name.includes('frozen yogurt')) score -= 0.4;
  if (name.includes('pancake') || name.includes('waffle')) score -= 0.4;
  if (name.includes('buffet')) score -= 0.2;
  if (name.includes('casino')) score -= 0.3;
  if (name.includes('cafe') && !name.includes('grill')) score -= 0.1;
  
  if (types.includes('bakery')) score -= 0.35;
  if (types.includes('dessert_shop')) score -= 0.3;
  if (types.includes('ice_cream_shop')) score -= 0.4;
  if (types.includes('pizza_restaurant')) score -= 0.35;
  if (types.includes('fast_food_restaurant')) score -= 0.15;
  
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

function getDiningOptions(place) {
  return ['Dine-in', 'Takeout'];
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
    .then(() => console.log('✅ Database tables initialized'))
    .catch(err => console.error('❌ Database initialization error:', err));
} else {
  console.error('❌ Cannot initialize database - initDatabase function not available');
}

app.listen(PORT, () => {
  console.log(`🚀 Keto Hunter API running on port ${PORT}`);
  console.log(`Database status: ${saveReview ? '✅ Connected' : '❌ Not Connected'}`);
  console.log(`Clerk status: ${clerkClient ? '✅ Configured' : '❌ Not Configured'}`);
});