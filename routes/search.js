const express = require('express');
const axios = require('axios');

function createRouter({ scoring }) {
  const router = express.Router();

  function processRestaurants(places, userLat, userLon) {
    console.log(`[DEBUG] Processing ${places.length} places from Google`);

    const restaurants = places.map((place, index) => {
      const name = place.displayName?.text || 'Unknown';
      const types = place.types || [];
      const cuisine = scoring.getCuisineType(types, name);

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
        priceLevel: place.priceLevel ? scoring.getPriceLevel(place.priceLevel) : 2,
        cuisine: cuisine,
        distance: scoring.calculateDistance(userLat, userLon,
          place.location.latitude,
          place.location.longitude),
        lat: place.location.latitude,
        lng: place.location.longitude,
        ketoScore: scoring.calculateKetoScore(place),
        diningOptions: scoring.getDiningOptions(place),
        isChain: scoring.detectChain(name) !== null
      };
    });

    const filtered = restaurants.filter(r => r.ketoScore >= 0.2);

    const cuisineCounts = {};
    filtered.forEach(r => {
      cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1;
    });
    console.log(`[DEBUG] After filtering (${filtered.length} restaurants):`);
    console.log(`[DEBUG] Cuisine breakdown:`, cuisineCounts);

    return filtered.sort((a, b) => {
      if (Math.abs(a.ketoScore - b.ketoScore) > 0.1) {
        return b.ketoScore - a.ketoScore;
      }
      return parseFloat(a.distance) - parseFloat(b.distance);
    });
  }

  // Geocode an address to lat/lng
  router.post('/api/geocode', async (req, res) => {
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
  router.post('/api/search-keto-restaurants', async (req, res) => {
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

      const searchCenters = [];

      if (radius <= 16093) {
        searchCenters.push({ lat: latitude, lng: longitude, name: 'center', maxResults: 20 });
      } else {
        const offset = radius * 0.5;
        const latOffset = offset / 111320;
        const lngOffset = offset / (111320 * Math.cos(latitude * Math.PI / 180));

        searchCenters.push(
          { lat: latitude, lng: longitude, name: 'center', maxResults: 20 },
          { lat: latitude + latOffset, lng: longitude, name: 'north', maxResults: 15 },
          { lat: latitude - latOffset, lng: longitude, name: 'south', maxResults: 15 },
          { lat: latitude, lng: longitude + lngOffset, name: 'east', maxResults: 15 },
          { lat: latitude, lng: longitude - lngOffset, name: 'west', maxResults: 15 }
        );
      }

      console.log(`[MULTI-POINT] Using ${searchCenters.length} search centers for ${(radius / 1609.34).toFixed(1)} mile radius`);

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

      const allPlaces = new Map();

      const searchPromises = [];

      for (const center of searchCenters) {
        for (const group of searchGroups) {
          searchPromises.push(
            (async () => {
              try {
                const searchRadius = radius / searchCenters.length;

                if (searchCenters.length === 1) {
                  console.log(`[SEARCH] ${group.name} (types: ${group.types.join(', ')})`);
                } else {
                  console.log(`[SEARCH] ${group.name} from ${center.name} point`);
                }

                const response = await axios.post(
                  'https://places.googleapis.com/v1/places:searchNearby',
                  {
                    includedTypes: group.types,
                    maxResultCount: center.maxResults,
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

      await Promise.all(searchPromises);

      const uniquePlaces = Array.from(allPlaces.values());
      const restaurants = processRestaurants(uniquePlaces, latitude, longitude);

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

  return router;
}

module.exports = createRouter;
