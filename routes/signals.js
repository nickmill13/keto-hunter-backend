const express = require('express');
const axios = require('axios');

function createRouter({ db, requireAuth, scoring, reviewAnalysis, chainMenuData }) {
  const router = express.Router();

  // Get stored NLP signals for a restaurant (public)
  router.get('/api/restaurant-signals/:restaurantId', async (req, res) => {
    try {
      if (!db.getRestaurantSignals) {
        return res.status(500).json({
          error: 'Database not initialized',
          signals: null
        });
      }

      const restaurantId = req.params.restaurantId;
      const signals = await db.getRestaurantSignals(restaurantId);

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
  router.post('/api/restaurant-signals/:restaurantId', requireAuth, async (req, res) => {
    try {
      if (!db.upsertRestaurantSignals) {
        return res.status(500).json({
          error: 'Database not initialized'
        });
      }

      const restaurantId = req.params.restaurantId;
      const signals = req.body;

      const saved = await db.upsertRestaurantSignals(restaurantId, signals);

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

  // Analyze Google reviews with keyword-based signal extraction
  router.post('/api/analyze-google-reviews/:restaurantId', async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { restaurantName } = req.body || {};

      // Short-circuit: known chains have verified nutrition — no need to guess from reviews
      if (restaurantName) {
        const chainInfo = scoring.detectChain(restaurantName);
        if (chainInfo) {
          const menuKey = scoring.getChainMenuKey(chainInfo);
          const menuData = chainMenuData[menuKey];
          if (menuData && menuData.combos && menuData.combos.length > 0) {
            const bestItem = [...menuData.combos].sort((a, b) => a.carbs - b.carbs)[0];
            const lowCarbCount = menuData.combos.filter(c => c.carbs <= 5).length;
            const summary = `Verified: ${menuData.combos.length} keto options from ${chainInfo.name} (${lowCarbCount} under 5g carbs). Best: ${bestItem.name} — ${bestItem.carbs}g carbs, ${bestItem.protein}g protein`;

            const saved = await db.upsertRestaurantSignals(restaurantId, {
              ketoConfidence: 1.0,
              reasons: summary
            });

            console.log(`[OK] Chain short-circuit for ${chainInfo.name} — skipping Google review scan`);

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
        const result = reviewAnalysis.analyzeReviewText(r.text.text);

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

      const ketoConfidence = reviewAnalysis.calculateKetoConfidence(totals, reviewCount);
      const summary = reviewAnalysis.generateSignalsSummary(totals, ketoConfidence);

      const saved = await db.upsertRestaurantSignals(restaurantId, {
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

  return router;
}

module.exports = createRouter;
