const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { initDatabase, saveReview, getReviews, getReviewCount } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Keto Hunter API is running!' });
});

// Search for keto-friendly restaurants
app.post('/api/search-keto-restaurants', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.body;
    
    // Call Google Places API (New)
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        includedTypes: ['restaurant'],
        maxResultCount: 20,
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

    const restaurants = response.data.places.map(place => ({
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
      diningOptions: ['Dine-in', 'Takeout'],
      ketoReviews: Math.floor(Math.random() * 50) + 10
    }));

    const ketoFriendly = restaurants.filter(r => r.ketoScore > 0.4);

    res.json({ restaurants: ketoFriendly });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Submit review endpoint
app.post('/api/submit-review', async (req, res) => {
  try {
    const { restaurantId, restaurantName, rating, ketoRating, comment, menuItems, userName } = req.body;
    
    const review = await saveReview({
      restaurantId,
      restaurantName,
      userName,
      rating,
      ketoRating,
      comment,
      menuItems
    });
    
    console.log('Review saved to database:', review.id);
    res.json({ success: true, message: 'Review submitted!', review });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for a restaurant
app.get('/api/reviews/:restaurantId', async (req, res) => {
  try {
    const reviews = await getReviews(req.params.restaurantId);
    res.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
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
  let score = 0.5;
  
  const name = (place.displayName?.text || '').toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();
  
  if (name.includes('grill') || name.includes('steak') || name.includes('bbq')) score += 0.3;
  if (types.includes('steak')) score += 0.4;
  if (types.includes('seafood')) score += 0.3;
  if (types.includes('mediterranean')) score += 0.2;
  if (types.includes('mexican')) score += 0.1;
  
  if (types.includes('bakery') || types.includes('dessert')) score -= 0.3;
  if (name.includes('pizza') || name.includes('pasta')) score -= 0.2;
  
  return Math.max(0.3, Math.min(1.0, score));
}

function getCuisineType(types) {
  const cuisineMap = {
    'steak_house': 'Steakhouse',
    'seafood_restaurant': 'Seafood',
    'mexican_restaurant': 'Mexican',
    'mediterranean_restaurant': 'Mediterranean',
    'american_restaurant': 'American',
    'italian_restaurant': 'Italian',
    'japanese_restaurant': 'Asian',
    'chinese_restaurant': 'Asian',
    'indian_restaurant': 'Indian',
    'thai_restaurant': 'Thai',
    'barbecue_restaurant': 'BBQ',
    'bar': 'Bar & Grill'
  };
  
  for (const type of types) {
    if (cuisineMap[type]) return cuisineMap[type];
  }
  return 'Restaurant';
}

function getKetoOptions(types) {
  const typeStr = types.join(' ').toLowerCase();
  
  if (typeStr.includes('steak')) return ['Grilled Steak', 'Caesar Salad', 'Roasted Vegetables'];
  if (typeStr.includes('seafood')) return ['Grilled Fish', 'Shrimp', 'Lobster'];
  if (typeStr.includes('mexican')) return ['Burrito Bowl (no rice)', 'Fajitas', 'Carnitas'];
  if (typeStr.includes('mediterranean')) return ['Greek Salad', 'Grilled Chicken', 'Lamb'];
  
  return ['Salads', 'Grilled Protein', 'Vegetables'];
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}
// Initialize database on startup
initDatabase();

app.listen(PORT, () => {
  console.log(`Keto Hunter API running on port ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Keto Hunter API running on port ${PORT}`);
});