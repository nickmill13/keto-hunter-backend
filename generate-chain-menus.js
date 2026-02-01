const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const USDA_API_KEY = process.env.USDA_API_KEY;
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// All chains from your detectChain() function
const chains = {
  mcdonalds: {
    name: "McDonald's",
    searchTerms: [
      "McDonald's hamburger",
      "McDonald's cheeseburger",
      "McDonald's quarter pounder",
      "McDonald's bacon egg cheese",
      "McDonald's sausage egg cheese",
      "McDonald's chicken mcnuggets",
      "McDonald's side salad",
      "McDonald's bacon"
    ],
    orderTips: [
      "Order bunless burgers through the McDonald's app under 'Customizations'",
      "For breakfast items, select 'No Biscuit' or 'No Muffin'",
      "Ask for sauce on the side to control carb intake"
    ]
  },
  wendys: {
    name: "Wendy's",
    searchTerms: [
      "Wendy's Dave's Single",
      "Wendy's Baconator",
      "Wendy's bacon cheeseburger",
      "Wendy's caesar salad",
      "Wendy's chili",
      "Wendy's chicken nuggets",
      "Wendy's bacon"
    ],
    orderTips: [
      "Order any burger as a 'FrostyMelt' style (wrapped in lettuce)",
      "Wendy's chili is surprisingly low carb at ~15g",
      "Ask for 'no bun' on any burger"
    ]
  },
  chickfila: {
    name: "Chick-fil-A",
    searchTerms: [
      "Chick-fil-A grilled chicken sandwich",
      "Chick-fil-A grilled nuggets",
      "Chick-fil-A cobb salad",
      "Chick-fil-A bacon egg cheese",
      "Chick-fil-A grilled chicken strips",
      "Chick-fil-A side salad"
    ],
    orderTips: [
      "Order grilled items, NOT fried",
      "Get the Cobb Salad with no corn and croutons removed",
      "Grilled nuggets are a great snack option"
    ]
  },
  burgerkingus: {
    name: "Burger King",
    searchTerms: [
      "Burger King Whopper",
      "Burger King bacon king",
      "Burger King chicken sandwich",
      "Burger King bacon cheeseburger",
      "Burger King onion rings",
      "Burger King side salad"
    ],
    orderTips: [
      "Order any burger 'lettuce style' (wrapped in lettuce instead of bun)",
      "The Whopper works great as a lettuce wrap",
      "Bacon King lettuce style is a top keto pick"
    ]
  },
  chipotle: {
    name: "Chipotle",
    searchTerms: [
      "Chipotle carnitas bowl",
      "Chipotle steak bowl",
      "Chipotle chicken bowl",
      "Chipotle barbacoa bowl",
      "Chipotle sofritas",
      "Chipotle guacamole"
    ],
    orderTips: [
      "Order any bowl with NO rice and NO beans",
      "Double meat + guacamole + cheese is a great combo",
      "Add extra sour cream for healthy fats"
    ]
  },
  fiveguys: {
    name: "Five Guys",
    searchTerms: [
      "Five Guys burger",
      "Five Guys bacon cheeseburger",
      "Five Guys little burger",
      "Five Guys cajun fries",
      "Five Guys bacon"
    ],
    orderTips: [
      "Order any burger 'bunless' — they wrap it in foil",
      "Little Cheeseburger bunless is the most popular keto order",
      "All toppings are free — load up on cheese, bacon, lettuce, tomato"
    ]
  },
  panera: {
    name: "Panera Bread",
    searchTerms: [
      "Panera caesar salad",
      "Panera greek salad",
      "Panera chicken salad",
      "Panera bacon egg cheese",
      "Panera grilled chicken"
    ],
    orderTips: [
      "Salads are your best bet — skip croutons",
      "Get protein added to any salad",
      "Avoid soups — most have high carb bases"
    ]
  },
  subway: {
    name: "Subway",
    searchTerms: [
      "Subway turkey salad",
      "Subway chicken bacon ranch salad",
      "Subway tuna salad",
      "Subway steak salad",
      "Subway bacon"
    ],
    orderTips: [
      "Order any sub as a salad bowl instead",
      "Double meat on your salad for more protein",
      "Avocado and cheese are great keto add-ons"
    ]
  },
  tacobell: {
    name: "Taco Bell",
    searchTerms: [
      "Taco Bell power bowl",
      "Taco Bell chicken power bowl",
      "Taco Bell steak power bowl",
      "Taco Bell cheese quesadilla",
      "Taco Bell nachos bell grande"
    ],
    orderTips: [
      "Order any power bowl with NO rice and NO beans",
      "Use the app to customize — remove all carbs",
      "Cheese and sour cream are your friends here"
    ]
  },
  outback: {
    name: "Outback Steakhouse",
    searchTerms: [
      "Outback Steakhouse ribeye steak",
      "Outback Steakhouse sirloin",
      "Outback Steakhouse grilled chicken",
      "Outback Steakhouse caesar salad",
      "Outback Steakhouse grilled shrimp"
    ],
    orderTips: [
      "Most steaks come with a baked potato — swap for a salad",
      "Ask for no seasoning blend if watching sodium",
      "Grilled veggies are a great low-carb side"
    ]
  },
  texasroadhouse: {
    name: "Texas Roadhouse",
    searchTerms: [
      "Texas Roadhouse ribeye steak",
      "Texas Roadhouse sirloin steak",
      "Texas Roadhouse grilled chicken",
      "Texas Roadhouse caesar salad",
      "Texas Roadhouse bacon"
    ],
    orderTips: [
      "Swap the baked potato or mashed potatoes for a salad",
      "Steaks are cooked to order — perfect for keto",
      "Ask for butter on the side for your veggies"
    ]
  },
  buffalowildwings: {
    name: "Buffalo Wild Wings",
    searchTerms: [
      "Buffalo Wild Wings chicken wings",
      "Buffalo Wild Wings boneless wings",
      "Buffalo Wild Wings grilled chicken",
      "Buffalo Wild Wings caesar salad",
      "Buffalo Wild Wings bacon"
    ],
    orderTips: [
      "Traditional (bone-in) wings are zero carb — boneless are breaded!",
      "Dry rub flavors have fewer carbs than wet sauces",
      "Ask for veggies instead of fries"
    ]
  }
};

// Bun/bread carb values to subtract when needed
const BUN_CARBS = {
  regularBun: 26,
  largeBun: 34,
  biscuit: 28,
  englishMuffin: 25,
  tortilla: 28
};

async function searchUSDA(query) {
  try {
    const response = await axios.get(`${USDA_BASE}/foods/search`, {
      params: {
        api_key: USDA_API_KEY,
        query: query,
        dataType: 'Branded',
        pageSize: 5
      }
    });

    return response.data.foods || [];
  } catch (error) {
    console.error(`  ❌ USDA search failed for "${query}":`, error.message);
    return [];
  }
}

function extractNutrition(food) {
  const nutrients = food.foodNutrients || [];

  const get = (name) => {
    const n = nutrients.find(n => n.nutrientName?.toLowerCase().includes(name.toLowerCase()));
    return n?.value || 0;
  };

  return {
    name: food.description,
    brandOwner: food.brandOwner || '',
    carbs: Math.round(get('carbohydrates') * 10) / 10,
    protein: Math.round(get('protein') * 10) / 10,
    fat: Math.round(get('total fat') * 10) / 10,
    calories: Math.round(get('energy') || get('calories')),
    servingSize: food.servingSize || '',
    verified: true
  };
}

function isBunItem(name) {
  const lower = name.toLowerCase();
  return lower.includes('burger') || lower.includes('sandwich') ||
         lower.includes('mcmuffin') || lower.includes('biscuit') ||
         lower.includes('muffin');
}

function createBunlessVariant(item) {
  const lower = item.name.toLowerCase();
  let bunCarbs = BUN_CARBS.regularBun;

  if (lower.includes('biscuit')) bunCarbs = BUN_CARBS.biscuit;
  else if (lower.includes('muffin')) bunCarbs = BUN_CARBS.englishMuffin;
  else if (lower.includes('large') || lower.includes('quarter')) bunCarbs = BUN_CARBS.largeBun;

  return {
    ...item,
    name: item.name.replace(/\b(burger|sandwich)\b/gi, '$1 (No Bun)')
      .replace(/\bbiscuit\b/gi, '(No Biscuit)')
      .replace(/\bmuffin\b/gi, '(No Muffin)'),
    carbs: Math.max(0, Math.round((item.carbs - bunCarbs) * 10) / 10),
    orderAs: `Order as-is, remove the bun/bread`
  };
}

async function generateChainMenu(chainKey, chainConfig) {
  console.log(`\n🍽️  Processing: ${chainConfig.name}`);

  const allItems = [];
  const seen = new Set();

  for (const term of chainConfig.searchTerms) {
    console.log(`  🔎 Searching: "${term}"`);
    const results = await searchUSDA(term);

    // Filter to only this brand
    const brandName = chainConfig.name.toLowerCase().replace(/[^a-z]/g, '');
    const brandResults = results.filter(food => {
      const owner = (food.brandOwner || '').toLowerCase().replace(/[^a-z]/g, '');
      const desc = (food.description || '').toLowerCase();
      return owner.includes(brandName) || desc.includes(chainConfig.name.toLowerCase());
    });

    for (const food of brandResults) {
      const item = extractNutrition(food);

      // Skip duplicates
      if (seen.has(item.name)) continue;
      seen.add(item.name);

      // If it's a bun item, create a bunless variant
      if (isBunItem(item.name)) {
        const bunless = createBunlessVariant(item);
        if (bunless.carbs < 20) {
          allItems.push(bunless);
          console.log(`    ✅ ${bunless.name} — ${bunless.carbs}g carbs`);
        }
      } else if (item.carbs < 20) {
        allItems.push(item);
        console.log(`    ✅ ${item.name} — ${item.carbs}g carbs`);
      }
    }

    // Rate limit — USDA allows 1000/day but let's be polite
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    chainName: chainConfig.name,
    source: 'USDA FoodData Central (Branded Foods)',
    lastUpdated: new Date().toISOString().split('T')[0],
    orderTips: chainConfig.orderTips,
    combos: allItems
  };
}

async function main() {
  console.log('🚀 Starting chain menu generator...');
  console.log(`📋 Processing ${Object.keys(chains).length} chains\n`);

  if (!USDA_API_KEY) {
    console.error('❌ USDA_API_KEY not found in .env!');
    console.error('Get one free at: https://fdc.nal.usda.gov/fdc-app.html#/');
    process.exit(1);
  }

  // Load existing manual data to preserve it
  let existingData = {};
  try {
    existingData = require('./chain-menus.json');
    console.log(`📂 Loaded existing data for: ${Object.keys(existingData).join(', ')}`);
  } catch (e) {
    console.log('📂 No existing chain-menus.json found, starting fresh');
  }

  const output = { ...existingData };

  for (const [key, config] of Object.entries(chains)) {
    const chainData = await generateChainMenu(key, config);

    if (chainData.combos.length > 0) {
      output[key] = chainData;
      console.log(`  📊 ${config.name}: ${chainData.combos.length} keto items found`);
    } else {
      console.log(`  ⚠️  ${config.name}: No keto items found from USDA`);
    }
  }

  // Write output
  fs.writeFileSync('./chain-menus.json', JSON.stringify(output, null, 2));

  console.log('\n✅ Done! chain-menus.json updated');
  console.log(`📊 Total chains: ${Object.keys(output).length}`);
  console.log(`🍽️  Total keto items: ${Object.values(output).reduce((sum, c) => sum + (c.combos?.length || 0), 0)}`);
}

main().catch(console.error);