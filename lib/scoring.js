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
  'starbucks':            { name: 'Starbucks',               menuKey: 'starbucks',         ketoQueries: ['starbucks egg bites','bacon gruyere egg bites','chicken sausage egg bites','unsweetened iced coffee'] },
  'olive garden':         { name: 'Olive Garden',            menuKey: 'olivegarden',       ketoQueries: ['olive garden grilled chicken','olive garden shrimp scampi no pasta','olive garden salmon'] },
  'red lobster':          { name: 'Red Lobster',             menuKey: 'redlobster',        ketoQueries: ['red lobster live maine lobster','red lobster wood-grilled lobster tail','red lobster grilled salmon'] },
  'buffalo wild wings':   { name: 'Buffalo Wild Wings',      menuKey: 'buffalowildwings',  ketoQueries: ['buffalo wild wings traditional wings','buffalo wild wings naked tenders','buffalo wild wings caesar salad'] },
  'outback':              { name: 'Outback Steakhouse',      menuKey: 'outback',           ketoQueries: ['outback ribeye steak','outback victoria filet','outback grilled chicken'] },
  'texas roadhouse':      { name: 'Texas Roadhouse',         menuKey: 'texasroadhouse',    ketoQueries: ['texas roadhouse ribeye','texas roadhouse sirloin','texas roadhouse grilled chicken salad'] },
  'longhorn':             { name: 'LongHorn Steakhouse',     menuKey: 'longhorn',          ketoQueries: ['longhorn outlaw ribeye','longhorn flo filet','longhorn grilled salmon'] },
  'applebee':             { name: "Applebee's",              menuKey: 'applebees',         ketoQueries: ['applebees bourbon street steak','applebees grilled chicken caesar salad','applebees shrimp'] },
  'chili':                { name: "Chili's",                 menuKey: 'chilis',            ketoQueries: ['chilis ancho salmon','chilis grilled chicken salad','chilis chicken fajitas no tortilla'] },
  'tgi friday':           { name: "TGI Friday's",            menuKey: 'tgifridays',        ketoQueries: ['tgi fridays grilled salmon','tgi fridays steak','tgi fridays caesar salad'] },
  'in-n-out':             { name: 'In-N-Out Burger',         menuKey: 'innout',            ketoQueries: ['in n out protein style burger','in n out double double protein style','in n out cheeseburger lettuce wrap'] },
  'shake shack':          { name: 'Shake Shack',             menuKey: 'shakeshack',        ketoQueries: ['shake shack lettuce wrap burger','shake shack shackburger no bun','shake shack cheese fries no fries'] },
  'jimmy john':           { name: "Jimmy John's",            menuKey: 'jimmyjohns',        ketoQueries: ['jimmy johns unwich turkey','jimmy johns lettuce wrap italian','jimmy johns unwich club'] },
  'jersey mike':          { name: "Jersey Mike's",           menuKey: 'jerseymikes',       ketoQueries: ['jersey mikes sub in a tub','jersey mikes chipotle cheesesteak bowl','jersey mikes club bowl'] },
  'qdoba':                { name: 'Qdoba',                   menuKey: 'qdoba',             ketoQueries: ['qdoba steak bowl no rice','qdoba chicken salad','qdoba fajita bowl no beans'] },
  'moe':                  { name: "Moe's Southwest Grill",   menuKey: 'moes',              ketoQueries: ['moes chicken bowl no rice','moes steak salad','moes carnitas bowl'] },
  'wingstop':             { name: 'Wingstop',                menuKey: 'wingstop',          ketoQueries: ['wingstop classic wings','wingstop original hot wings','wingstop lemon pepper wings'] },
  'popeyes':              { name: 'Popeyes',                 menuKey: 'popeyes',           ketoQueries: ['popeyes blackened chicken tenders','popeyes naked chicken','popeyes green beans'] },
  'kfc':                  { name: 'KFC',                     menuKey: 'kfc',               ketoQueries: ['kfc grilled chicken breast','kfc original chicken no breading','kfc green beans'] },
  'panda express':        { name: 'Panda Express',           menuKey: 'pandaexpress',      ketoQueries: ['panda express grilled teriyaki chicken','panda express string bean chicken breast','panda express mushroom chicken'] },
  'cheesecake factory':   { name: 'The Cheesecake Factory',  menuKey: 'cheesecakefactory', ketoQueries: ['cheesecake factory grilled salmon','cheesecake factory steak','cheesecake factory chicken salad'] },
  'red robin':            { name: 'Red Robin',               menuKey: 'redrobin',          ketoQueries: ['red robin lettuce wrap burger','red robin tavern burger no bun','red robin wedgie burger'] },
  'carrabba':             { name: "Carrabba's Italian Grill",menuKey: 'carrabbas',         ketoQueries: ['carrabbas chicken bryan','carrabbas grilled salmon','carrabbas sirloin marsala'] },
  'poke bros':            { name: 'Poke Bros',               menuKey: 'pokebros',          ketoQueries: ['poke bros salad base bowl','poke bros salmon avocado bowl','poke bros tuna cucumber bowl'] },
  'baja':                 { name: "Baja's",                  menuKey: 'bajas',             ketoQueries: ['bajas salad bowl chicken no rice','bajas chicken wings plain','bajas birria meat no tortilla','bajas steak salad bowl'] },
  'legal sea':            { name: 'Legal Sea Foods',          menuKey: 'legalseafoods',     ketoQueries: ['legal sea foods grilled salmon broccoli','legal sea foods steamed lobster','legal sea foods caesar salad grilled chicken','legal sea foods ribeye steak','legal sea foods sashimi'] }
};

// Module-level reference to chain menu data, set via init()
let chainMenuData = {};

function init(menuData) {
  chainMenuData = menuData;
}

function getChainMenuKey(chainInfo) {
  return chainInfo?.menuKey || null;
}

function detectChain(restaurantName) {
  const name = restaurantName.toLowerCase();
  for (const [key, chain] of Object.entries(CHAIN_REGISTRY)) {
    if (name.includes(key)) {
      return chain;
    }
  }
  return null;
}

function calculateChainKetoScore(menuData) {
  const combos = menuData.combos;
  const lowCarbCount = combos.filter(c => c.carbs <= 5).length;
  const avgCarbs = combos.reduce((sum, c) => sum + c.carbs, 0) / combos.length;
  const hasZeroCarb = combos.some(c => c.carbs === 0);

  const modificationKeywords = ['no bun', 'bunless', 'no bread', 'no biscuit', 'no croissant',
                                'no muffin', 'no tortilla', 'no rice', 'protein style', 'lettuce wrap'];
  const itemsRequiringMods = combos.filter(c => {
    const orderAs = (c.orderAs || '').toLowerCase();
    const itemName = (c.name || '').toLowerCase();
    return modificationKeywords.some(keyword => orderAs.includes(keyword) || itemName.includes(keyword));
  }).length;

  const customizationRatio = itemsRequiringMods / combos.length;
  const naturalness = menuData.ketoNaturalness || 0.70;

  let score = 0.35 + (naturalness * 0.35);
  score -= (customizationRatio * 0.15);
  score += (lowCarbCount / combos.length) * 0.15;
  score += Math.max(0, (12 - avgCarbs) / 12) * 0.08;
  if (hasZeroCarb) score += 0.02;

  return Math.min(0.95, Math.max(0.30, Math.round(score * 100) / 100));
}

function calculateKetoScore(place) {
  const name = place.displayName?.text || '';

  const chainInfo = detectChain(name);
  if (chainInfo) {
    const menuKey = getChainMenuKey(chainInfo);
    const menuData = chainMenuData[menuKey];
    if (menuData && menuData.combos && menuData.combos.length > 0) {
      return calculateChainKetoScore(menuData);
    }
  }

  const nameLower = name.toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();
  const rating = place.rating || 4.0;
  const typesArray = place.types || [];

  const highCarbTypes = ['juice_shop', 'acai_shop', 'smoothie_shop', 'ice_cream_shop',
                         'bakery', 'dessert_shop', 'dessert_restaurant', 'candy_store',
                         'donut_shop', 'bagel_shop', 'cookie_shop'];
  const hasHighCarbType = typesArray.some(t => highCarbTypes.includes(t));

  if (hasHighCarbType) {
    return Math.max(0.2, Math.min(0.35, 0.25));
  }

  let score = 0.55;

  const nameCuisineOverride =
    (nameLower.includes('italian') || nameLower.includes('trattoria') || nameLower.includes('pizzeria') || nameLower.includes('ristorante')) ? 0.48 :
    (nameLower.includes('chinese') || nameLower.includes('wok') || nameLower.includes('mandarin')) ? 0.50 :
    (nameLower.includes('thai')) ? 0.55 :
    (nameLower.includes('sushi') || nameLower.includes('ramen')) ? 0.58 :
    (nameLower.includes('indian') || nameLower.includes('tandoori')) ? 0.60 :
    null;

  if (nameCuisineOverride !== null) {
    score = nameCuisineOverride;
  }
  else if (types.includes('steak_house'))              score = 0.80;
  else if (types.includes('barbecue_restaurant')) score = 0.75;
  else if (types.includes('brazilian_restaurant'))score = 0.75;
  else if (types.includes('seafood_restaurant'))  score = 0.72;
  else if (types.includes('mediterranean_restaurant')) score = 0.68;
  else if (types.includes('greek_restaurant'))    score = 0.68;
  else if (types.includes('indian_restaurant'))   score = 0.60;
  else if (types.includes('mexican_restaurant'))  score = 0.58;
  else if (types.includes('japanese_restaurant')) score = 0.58;
  else if (types.includes('american_restaurant')) score = 0.58;
  else if (types.includes('korean_restaurant'))   score = 0.57;
  else if (types.includes('thai_restaurant'))     score = 0.55;
  else if (types.includes('chinese_restaurant'))  score = 0.50;
  else if (types.includes('italian_restaurant'))  score = 0.48;
  else if (types.includes('hamburger_restaurant'))score = 0.55;

  if (nameLower.includes('grill') || nameLower.includes('grille')) score += 0.10;
  if (nameLower.includes('steak') || nameLower.includes('steakhouse')) score += 0.15;
  if (nameLower.includes('bbq') || nameLower.includes('barbecue') || nameLower.includes('smokehouse')) score += 0.12;
  if (nameLower.includes('seafood') || nameLower.includes('fish')) score += 0.10;
  if (nameLower.includes('meat') || nameLower.includes('butcher')) score += 0.10;
  if (nameLower.includes('salad')) score += 0.08;
  if (nameLower.includes('protein') || nameLower.includes('fit') || nameLower.includes('healthy')) score += 0.10;
  if (nameLower.includes('wings') || nameLower.includes('wing')) score += 0.08;

  if (nameLower.includes('pizza')) score -= 0.4;
  if (nameLower.includes('pasta') || nameLower.includes('noodle')) score -= 0.35;
  if (nameLower.includes('bakery') || nameLower.includes('bread')) score -= 0.4;
  if (nameLower.includes('donut') || nameLower.includes('doughnut')) score -= 0.5;
  if (nameLower.includes('ice cream') || nameLower.includes('frozen yogurt')) score -= 0.4;
  if (nameLower.includes('pancake') || nameLower.includes('waffle')) score -= 0.4;
  if (nameLower.includes('smoothie') || nameLower.includes('juice') || nameLower.includes('acai')) score -= 0.4;
  if (nameLower.includes('berry') && !nameLower.includes('dingle')) score -= 0.25;
  if (nameLower.includes('bubble tea') || nameLower.includes('boba')) score -= 0.35;
  if (nameLower.includes('froyo') || nameLower.includes('yogurt')) score -= 0.3;
  if (nameLower.includes('buffet')) score -= 0.2;
  if (nameLower.includes('casino')) score -= 0.3;
  if (nameLower.includes('cafe') && !nameLower.includes('grill')) score -= 0.1;

  if (types.includes('pizza_restaurant')) score -= 0.35;
  if (types.includes('fast_food_restaurant')) score -= 0.05;

  if (rating >= 4.5)      score += 0.05;
  else if (rating >= 4.0) score += 0.03;
  else if (rating < 3.5)  score -= 0.03;

  return Math.max(0.2, Math.min(0.92, score));
}

function getCuisineType(types, name = '') {
  const nameLower = name.toLowerCase();

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

  for (const [cuisine, keywords] of Object.entries(nameKeywords)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return cuisine;
      }
    }
  }

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

  return 'American';
}

function getDiningOptions(place) {
  const types = (place.types || []).map(t => t.toLowerCase());
  const name = (place.displayName?.text || '').toLowerCase();
  const options = ['Dine-in', 'Takeout'];

  if (types.includes('drive_through') || name.includes('drive-through') || name.includes('drive thru')) {
    options.push('Drive-through');
  }

  if (types.includes('fast_food_restaurant') || types.includes('meal_takeaway')) {
    options.push('Delivery');
  }

  if (types.includes('bar') || types.includes('outdoor_restaurant') ||
      name.includes('patio') || name.includes('garden') || name.includes('outdoor')) {
    options.push('Outdoor Seating');
  }

  return options;
}

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

module.exports = {
  CHAIN_REGISTRY,
  init,
  getChainMenuKey,
  detectChain,
  calculateKetoScore,
  calculateChainKetoScore,
  getCuisineType,
  getDiningOptions,
  getPriceLevel,
  calculateDistance
};
