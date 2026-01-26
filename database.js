const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
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
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Save a review (now includes user_id)
async function saveReview(reviewData) {
  const { restaurantId, restaurantName, userName, rating, ketoRating, comment, menuItems, userId } = reviewData;
  
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
  
  return result.rows[0].avg_rating ? parseFloat(result.rows[0].avg_rating) : null;
}

module.exports = {
  initDatabase,
  saveReview,
  getReviews,
  getUserReviews,
  deleteReview,
  updateReview,
  getReviewCount,
  getAverageKetoRating
};