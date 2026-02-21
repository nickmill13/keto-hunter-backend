const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
    // Existing user reviews table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS keto_reviews (
        id SERIAL PRIMARY KEY,
        restaurant_id VARCHAR(255) NOT NULL,
        restaurant_name VARCHAR(255) NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
        keto_rating INTEGER CHECK (keto_rating BETWEEN 1 AND 5),
        comment TEXT,
        menu_items TEXT,
        user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // NLP signals derived from Google review analysis
    await pool.query(`
      CREATE TABLE IF NOT EXISTS restaurant_signals (
        restaurant_id VARCHAR(255) PRIMARY KEY,
        analyzed_at TIMESTAMP DEFAULT NOW(),

        keto_mentions INT DEFAULT 0,
        accommodating_mentions INT DEFAULT 0,
        customization_mentions INT DEFAULT 0,
        keto_food_mentions INT DEFAULT 0,
        healthy_cooking_mentions INT DEFAULT 0,
        dietary_mentions INT DEFAULT 0,
        portion_mentions INT DEFAULT 0,
        hidden_carb_mentions INT DEFAULT 0,
        high_carb_mentions INT DEFAULT 0,

        keto_confidence NUMERIC,
        reasons TEXT
      )
    `);

    // Migration: drop legacy columns if they still exist on older deployments
    const legacyColumns = [
      'lettuce_wrap_mentions',
      'bunless_mentions',
      'cauliflower_rice_mentions',
      'substitution_mentions',
      'breaded_risk_mentions',
      'sweet_sauce_risk_mentions'
    ];
    for (const col of legacyColumns) {
      await pool.query(`ALTER TABLE restaurant_signals DROP COLUMN IF EXISTS ${col}`);
    }

    // Favorite restaurants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorite_restaurants (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        restaurant_id VARCHAR(255) NOT NULL,
        restaurant_name VARCHAR(255) NOT NULL,
        restaurant_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, restaurant_id)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Save a review (now includes user_id)
async function saveReview(reviewData) {
  const {
    restaurantId,
    restaurantName,
    userName,
    rating,
    ketoRating,
    comment,
    menuItems,
    userId
  } = reviewData;

  const result = await pool.query(
    `INSERT INTO keto_reviews 
     (restaurant_id, restaurant_name, user_name, overall_rating, keto_rating, comment, menu_items, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [restaurantId, restaurantName, userName, rating, ketoRating, comment, menuItems, userId]
  );

  return result.rows[0];
}

// Get reviews for a restaurant
async function getReviews(restaurantId) {
  const result = await pool.query(
    `SELECT * FROM keto_reviews 
     WHERE restaurant_id = $1 
     ORDER BY created_at DESC`,
    [restaurantId]
  );

  return result.rows;
}

// Get all reviews by a specific user
async function getUserReviews(userId) {
  const result = await pool.query(
    `SELECT * FROM keto_reviews 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

// Delete a review (only if it belongs to the user)
async function deleteReview(reviewId, userId) {
  const result = await pool.query(
    `DELETE FROM keto_reviews 
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [reviewId, userId]
  );

  return result.rows[0];
}

// Update a review (only if it belongs to the user)
async function updateReview(reviewId, userId, updateData) {
  const { rating, ketoRating, comment, menuItems } = updateData;

  const result = await pool.query(
    `UPDATE keto_reviews 
     SET overall_rating = $1, keto_rating = $2, comment = $3, menu_items = $4
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [rating, ketoRating, comment, menuItems, reviewId, userId]
  );

  return result.rows[0];
}

// Get review count for a restaurant
async function getReviewCount(restaurantId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM keto_reviews WHERE restaurant_id = $1`,
    [restaurantId]
  );

  return parseInt(result.rows[0].count);
}

// Get average keto rating for a restaurant
async function getAverageKetoRating(restaurantId) {
  const result = await pool.query(
    `SELECT AVG(keto_rating) as avg_rating FROM keto_reviews WHERE restaurant_id = $1`,
    [restaurantId]
  );

  return result.rows[0].avg_rating
    ? parseFloat(result.rows[0].avg_rating)
    : null;
}

// Get stored signals for a restaurant (returns null if none)
async function getRestaurantSignals(restaurantId) {
  const result = await pool.query(
    `SELECT * FROM restaurant_signals WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return result.rows[0] || null;
}

// Upsert (insert or update) signals for a restaurant
async function upsertRestaurantSignals(restaurantId, signals) {
  const {
    ketoMentions = 0,
    accommodatingMentions = 0,
    customizationMentions = 0,
    ketoFoodMentions = 0,
    healthyCookingMentions = 0,
    dietaryMentions = 0,
    portionMentions = 0,
    hiddenCarbMentions = 0,
    highCarbMentions = 0,
    ketoConfidence = null,
    reasons = null
  } = signals || {};

  const result = await pool.query(
    `INSERT INTO restaurant_signals (
      restaurant_id,
      analyzed_at,
      keto_mentions,
      accommodating_mentions,
      customization_mentions,
      keto_food_mentions,
      healthy_cooking_mentions,
      dietary_mentions,
      portion_mentions,
      hidden_carb_mentions,
      high_carb_mentions,
      keto_confidence,
      reasons
    ) VALUES (
      $1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    )
    ON CONFLICT (restaurant_id) DO UPDATE SET
      analyzed_at = NOW(),
      keto_mentions = EXCLUDED.keto_mentions,
      accommodating_mentions = EXCLUDED.accommodating_mentions,
      customization_mentions = EXCLUDED.customization_mentions,
      keto_food_mentions = EXCLUDED.keto_food_mentions,
      healthy_cooking_mentions = EXCLUDED.healthy_cooking_mentions,
      dietary_mentions = EXCLUDED.dietary_mentions,
      portion_mentions = EXCLUDED.portion_mentions,
      hidden_carb_mentions = EXCLUDED.hidden_carb_mentions,
      high_carb_mentions = EXCLUDED.high_carb_mentions,
      keto_confidence = EXCLUDED.keto_confidence,
      reasons = EXCLUDED.reasons
    RETURNING *`,
    [
      restaurantId,
      ketoMentions,
      accommodatingMentions,
      customizationMentions,
      ketoFoodMentions,
      healthyCookingMentions,
      dietaryMentions,
      portionMentions,
      hiddenCarbMentions,
      highCarbMentions,
      ketoConfidence,
      reasons
    ]
  );

  return result.rows[0];
}

// Add a favorite restaurant
async function addFavorite(userId, restaurantId, restaurantName, restaurantData) {
  const result = await pool.query(
    `INSERT INTO favorite_restaurants (user_id, restaurant_id, restaurant_name, restaurant_data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, restaurant_id) DO NOTHING
     RETURNING *`,
    [userId, restaurantId, restaurantName, JSON.stringify(restaurantData)]
  );
  return result.rows[0];
}

// Remove a favorite restaurant
async function removeFavorite(userId, restaurantId) {
  const result = await pool.query(
    `DELETE FROM favorite_restaurants WHERE user_id = $1 AND restaurant_id = $2 RETURNING *`,
    [userId, restaurantId]
  );
  return result.rows[0];
}

// Get all favorites for a user
async function getUserFavorites(userId) {
  const result = await pool.query(
    `SELECT * FROM favorite_restaurants WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

// Check if a restaurant is favorited by a user
async function isFavorite(userId, restaurantId) {
  const result = await pool.query(
    `SELECT 1 FROM favorite_restaurants WHERE user_id = $1 AND restaurant_id = $2`,
    [userId, restaurantId]
  );
  return result.rows.length > 0;
}

module.exports = {
  initDatabase,
  saveReview,
  getReviews,
  getUserReviews,
  deleteReview,
  updateReview,
  getReviewCount,
  getAverageKetoRating,
  getRestaurantSignals,
  upsertRestaurantSignals,
  addFavorite,
  removeFavorite,
  getUserFavorites,
  isFavorite
};