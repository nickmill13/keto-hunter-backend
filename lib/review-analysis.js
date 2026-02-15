function analyzeReviewText(text) {
  const t = text.toLowerCase();

  const countMatches = (phrases) => phrases.filter(phrase => t.includes(phrase)).length;
  const getMatches = (phrases) => phrases.filter(phrase => t.includes(phrase));

  const ketoKeywords = ['keto', 'ketogenic', 'low carb', 'low-carb', 'lchf', 'paleo'];
  const ketoMentions = countMatches(ketoKeywords);

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

  const accommodatingKeywords = [
    'accommodating', 'accommodated',
    'willing to', 'happy to modify', 'no problem',
    'very flexible', 'flexible with',
    'made it without', 'left off', 'held the',
    'custom', 'customize', 'modification'
  ];
  const accommodatingMentions = countMatches(accommodatingKeywords);

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

  const healthyCookingKeywords = [
    'grilled', 'baked', 'roasted', 'steamed',
    'saut\u00e9ed', 'sauteed', 'pan-seared', 'broiled'
  ];
  const healthyCookingMentions = countMatches(healthyCookingKeywords);

  const dietaryKeywords = [
    'gluten free', 'gluten-free', 'dairy free', 'sugar free',
    'diet friendly', 'dietary restrictions', 'dietary needs',
    'nutrition', 'macros', 'calories', 'carbs'
  ];
  const dietaryMentions = countMatches(dietaryKeywords);

  const hiddenCarbKeywords = [
    'breaded', 'battered', 'fried coating',
    'sweet sauce', 'teriyaki', 'bbq sauce', 'honey',
    'glazed', 'candied', 'sweetened',
    'flour tortilla', 'corn tortilla'
  ];
  const hiddenCarbMentions = countMatches(hiddenCarbKeywords);

  const highCarbKeywords = [
    'pasta', 'noodles', 'rice', 'bread', 'bun',
    'potato', 'fries', 'chips',
    'pizza', 'dough',
    'dessert', 'cake', 'cookie', 'pastry',
    'pancake', 'waffle', 'toast'
  ];
  const highCarbMentions = countMatches(highCarbKeywords);

  const portionKeywords = [
    'huge portion', 'large portion', 'generous portion',
    'filling', 'substantial', 'plenty of protein'
  ];
  const portionMentions = countMatches(portionKeywords);

  return {
    ketoMentions,
    customizationMentions,
    accommodatingMentions,
    ketoFoodMentions,
    healthyCookingMentions,
    dietaryMentions,
    portionMentions,
    hiddenCarbMentions,
    highCarbMentions,
    foundKetoFoods: getMatches(ketoFoodKeywords),
    foundCustomizations: getMatches(customizationKeywords),
    foundCookingMethods: getMatches(healthyCookingKeywords),
  };
}

function calculateKetoConfidence(signals, reviewCount) {
  if (reviewCount === 0) return null;

  const weights = {
    ketoMentions: 3.0,
    customizationMentions: 2.5,
    accommodatingMentions: 2.0,
    ketoFoodMentions: 1.0,
    healthyCookingMentions: 0.8,
    dietaryMentions: 0.7,
    portionMentions: 0.5,
    hiddenCarbMentions: -1.5,
    highCarbMentions: -0.8
  };

  let score = 0;
  let maxPossibleScore = 0;

  Object.entries(weights).forEach(([key, weight]) => {
    const mentions = signals[key] || 0;
    score += mentions * weight;

    if (weight > 0) {
      maxPossibleScore += Math.abs(weight) * 3;
    }
  });

  let confidence = score / maxPossibleScore;
  const reviewBoost = Math.min(reviewCount / 20, 0.2);
  confidence += reviewBoost;
  confidence = Math.max(0, Math.min(1, confidence));

  return confidence;
}

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

  return summary.join(' \u2022 ');
}

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

module.exports = {
  analyzeReviewText,
  calculateKetoConfidence,
  generateSignalsSummary,
  getBasicKetoSuggestions
};
