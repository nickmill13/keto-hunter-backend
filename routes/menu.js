const express = require('express');
const axios = require('axios');

function createRouter({ scoring, openai, chainMenuData, localMenuVerified, reviewAnalysis }) {
  const router = express.Router();

  // Get verified menu data for a chain restaurant
  router.get('/api/chain-menu/:restaurantId', async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { restaurantName } = req.query;

      if (!restaurantName) {
        return res.json({ isChain: false, items: [] });
      }

      // Check for verified local menu data (by Place ID)
      const localVerified = localMenuVerified[restaurantId];
      if (localVerified && localVerified.combos && localVerified.combos.length > 0) {
        console.log(`[OK] Verified local menu found for "${localVerified.name}" (${restaurantId})`);
        return res.json({
          isChain: true,
          chainName: localVerified.name,
          items: localVerified.combos,
          orderTips: localVerified.orderTips || [],
          source: localVerified.source || 'Locally verified menu',
          message: `${localVerified.combos.length} verified keto options`
        });
      }

      // Check if it's a known chain
      const chainInfo = scoring.detectChain(restaurantName);

      if (!chainInfo) {
        return res.json({ isChain: false, items: [] });
      }

      // Use curated nutrition data if available
      const manualData = chainMenuData[scoring.getChainMenuKey(chainInfo)];

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

      // FALLBACK: Query API Ninjas for chains without manual data (parallelized)
      const results = await Promise.allSettled(
        chainInfo.ketoQueries.map(async (item) => {
          const response = await axios.get(
            `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(item)}`,
            {
              headers: {
                'X-Api-Key': process.env.API_NINJAS_KEY
              }
            }
          );
          return { item, data: response.data };
        })
      );

      const ketoItems = [];
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error(`Error fetching nutrition data:`, result.reason?.message);
          continue;
        }
        const { item, data } = result.value;
        if (data && data.length > 0) {
          const itemData = data[0];
          const carbs = itemData.carbohydrates_total_g || 0;

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

  // AI-estimated menu analysis for local (non-chain) restaurants
  router.post('/api/local-menu-analysis', async (req, res) => {
    try {
      const { restaurantName, cuisine, reviewSnippets } = req.body;

      if (!restaurantName) {
        return res.status(400).json({ error: 'restaurantName is required' });
      }

      if (scoring.detectChain(restaurantName)) {
        return res.json({ isLocal: false, items: [] });
      }

      if (!openai) {
        return res.json({
          isLocal: true,
          items: [],
          orderTips: [],
          message: 'AI not configured'
        });
      }

      const reviewContext = reviewSnippets && reviewSnippets.length > 0
        ? `\nGoogle reviewers mention these foods/items: ${reviewSnippets.join(', ')}`
        : '';

      const prompt = `You are a keto diet expert analyzing a local restaurant for keto-friendly options.

Restaurant: "${restaurantName}"
Cuisine type: ${cuisine || 'Unknown'}${reviewContext}

Based on what a ${cuisine || 'general'} restaurant typically serves, identify 5-7 dishes that are keto-friendly or can be made keto with simple modifications.

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    {
      "name": "Dish Name",
      "description": "Brief description of the dish",
      "carbs": 5,
      "protein": 30,
      "fat": 20,
      "calories": 350,
      "modification": "any modification needed, or null"
    }
  ],
  "orderTips": [
    "Tip for ordering keto at this type of restaurant"
  ],
  "ketoFriendliness": "brief 1-sentence assessment of how keto-friendly this cuisine typically is"
}

Rules:
- Estimate realistic nutrition values for each dish
- carbs should reflect net carbs after any modification
- Include modifications like "no rice", "no bun" where needed
- Keep items realistic for the cuisine type
- Order tips should be specific and actionable`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7
      });

      const responseText = completion.choices[0].message.content.trim();

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[LOCAL-MENU] Failed to parse AI response:', responseText);
        return res.json({
          isLocal: true,
          items: [],
          orderTips: [],
          message: 'Failed to parse AI analysis'
        });
      }

      const items = (parsed.items || []).map(item => ({
        name: item.name,
        description: item.description || '',
        carbs: Math.round((item.carbs || 0) * 10) / 10,
        protein: Math.round((item.protein || 0) * 10) / 10,
        fat: Math.round((item.fat || 0) * 10) / 10,
        calories: Math.round(item.calories || 0),
        modification: item.modification || null,
        estimated: true
      }));

      console.log(`[LOCAL-MENU] Generated ${items.length} estimated keto items for "${restaurantName}" (${cuisine})`);

      res.json({
        isLocal: true,
        restaurantName,
        cuisine,
        items,
        orderTips: parsed.orderTips || [],
        ketoFriendliness: parsed.ketoFriendliness || '',
        message: `${items.length} AI-estimated keto options`
      });

    } catch (error) {
      console.error('[LOCAL-MENU] Error:', error.message);
      res.status(500).json({
        error: 'Failed to analyze local restaurant menu',
        isLocal: true,
        items: []
      });
    }
  });

  // Get AI-suggested keto items for a restaurant
  router.post('/api/ai-suggestions', async (req, res) => {
    try {
      const { restaurantName, cuisine } = req.body;

      if (!openai) {
        const fallbackSuggestions = reviewAnalysis.getBasicKetoSuggestions(cuisine);
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

Respond with ONLY a JSON array of strings, nothing else. Example: ["Grilled Ribeye Steak", "Caesar Salad (no croutons)", "Saut\u00e9ed Spinach"]`;

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
        suggestions = reviewAnalysis.getBasicKetoSuggestions(cuisine);
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
        suggestions: reviewAnalysis.getBasicKetoSuggestions(cuisine),
        isAI: false,
        message: 'Fallback suggestions (AI error)'
      });
    }
  });

  return router;
}

module.exports = createRouter;
