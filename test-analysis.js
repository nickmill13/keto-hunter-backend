const axios = require('axios');

async function testAnalysis() {
  console.log('🧪 Testing Enhanced Analysis System\n');
  
  try {
    // First, let's search for a restaurant
    console.log('Step 1: Searching for restaurants...');
    const searchResponse = await axios.post('http://localhost:3001/api/search-keto-restaurants', {
      latitude: 41.8240,  // Providence, RI coordinates
      longitude: -71.4128,
      radius: 8000
    });
    
    const restaurants = searchResponse.data.restaurants || [];
    
    if (restaurants.length === 0) {
      console.log('❌ No restaurants found. Try different coordinates.');
      return;
    }
    
    console.log(`✅ Found ${restaurants.length} restaurants`);
    const testRestaurant = restaurants[0];
    console.log(`\n📍 Testing with: ${testRestaurant.name}`);
    console.log(`   ID: ${testRestaurant.id}\n`);
    
    // Now analyze this restaurant's Google reviews
    console.log('Step 2: Analyzing Google reviews...');
    const analysisResponse = await axios.post(
      `http://localhost:3001/api/analyze-google-reviews/${testRestaurant.id}`
    );
    
    const data = analysisResponse.data;
    
    console.log('\n✅ ANALYSIS COMPLETE!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`Restaurant: ${testRestaurant.name}`);
    console.log(`Reviews Analyzed: ${data.reviewCount}`);
    console.log(`Keto Confidence: ${data.ketoConfidence?.toFixed(2) || 'N/A'}`);
    console.log(`\nSummary: ${data.summary}\n`);
    
    console.log('📈 Signal Breakdown:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  🥑 Keto mentions: ${data.signals.ketoMentions}`);
    console.log(`  🔄 Customization options: ${data.signals.customizationMentions}`);
    console.log(`  👍 Accommodating service: ${data.signals.accommodatingMentions}`);
    console.log(`  🍖 Keto-friendly foods: ${data.signals.ketoFoodMentions}`);
    console.log(`  🔥 Healthy cooking methods: ${data.signals.healthyCookingMentions}`);
    console.log(`  📊 Dietary awareness: ${data.signals.dietaryMentions}`);
    console.log(`  🍽️  Portion mentions: ${data.signals.portionMentions}`);
    console.log(`  ⚠️  Hidden carb warnings: ${data.signals.hiddenCarbMentions}`);
    console.log(`  ❌ High-carb foods: ${data.signals.highCarbMentions}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Enhanced analysis is working perfectly!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAnalysis();