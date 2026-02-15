const express = require('express');

function createRouter({ db, requireAuth }) {
  const router = express.Router();

  // Submit review (requires auth)
  router.post('/api/submit-review', requireAuth, async (req, res) => {
    try {
      if (!db.saveReview) {
        console.error('[ERROR] ERROR: saveReview function is not available!');
        return res.status(500).json({
          error: 'Database not initialized. The database module failed to load - check server logs.',
          hint: 'Make sure DATABASE_URL is set in Railway variables'
        });
      }

      const { restaurantId, restaurantName, rating, ketoRating, comment, menuItems, userName } = req.body;

      const review = await db.saveReview({
        restaurantId,
        restaurantName,
        userName: userName || 'Anonymous',
        rating,
        ketoRating,
        comment,
        menuItems,
        userId: req.userId
      });

      console.log('[OK] Review saved successfully! Review ID:', review.id, 'User ID:', review.user_id);
      res.json({ success: true, message: 'Review submitted successfully!', review });
    } catch (error) {
      console.error('[ERROR] Error submitting review:', error);
      console.error('Error details:', error.message);
      res.status(500).json({
        error: 'Failed to submit review',
        details: error.message
      });
    }
  });

  // Get reviews for a restaurant (public - no auth required)
  router.get('/api/reviews/:restaurantId', async (req, res) => {
    try {
      if (!db.getReviews) {
        return res.status(500).json({
          error: 'Database not initialized',
          reviews: [],
          ketoItems: []
        });
      }

      const reviews = await db.getReviews(req.params.restaurantId);

      const ketoItemsSet = new Set();
      reviews.forEach(review => {
        if (review.menu_items) {
          review.menu_items.split(',').forEach(item => {
            const cleaned = item.trim();
            if (cleaned) {
              ketoItemsSet.add(cleaned);
            }
          });
        }
      });

      res.json({
        reviews,
        ketoItems: Array.from(ketoItemsSet),
        reviewCount: reviews.length
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ error: 'Failed to fetch reviews', reviews: [], ketoItems: [] });
    }
  });

  // Get current user's reviews - REQUIRES AUTH
  router.get('/api/my-reviews', requireAuth, async (req, res) => {
    try {
      if (!db.getUserReviews) {
        return res.status(500).json({ error: 'Database not initialized', reviews: [] });
      }

      const reviews = await db.getUserReviews(req.userId);
      console.log(`[OK] Fetched ${reviews.length} reviews for user ${req.userId}`);

      res.json({ reviews, reviewCount: reviews.length });
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      res.status(500).json({ error: 'Failed to fetch your reviews', reviews: [] });
    }
  });

  // Delete a review - REQUIRES AUTH
  router.delete('/api/reviews/:reviewId', requireAuth, async (req, res) => {
    try {
      if (!db.deleteReview) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const deleted = await db.deleteReview(req.params.reviewId, req.userId);

      if (!deleted) {
        return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
      }

      console.log(`[OK] Review ${req.params.reviewId} deleted by user ${req.userId}`);
      res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
      console.error('Error deleting review:', error);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  });

  // Update a review - REQUIRES AUTH
  router.put('/api/reviews/:reviewId', requireAuth, async (req, res) => {
    try {
      if (!db.updateReview) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const { rating, ketoRating, comment, menuItems } = req.body;

      const updated = await db.updateReview(req.params.reviewId, req.userId, {
        rating,
        ketoRating,
        comment,
        menuItems
      });

      if (!updated) {
        return res.status(404).json({ error: 'Review not found or you do not have permission to edit it' });
      }

      console.log(`[OK] Review ${req.params.reviewId} updated by user ${req.userId}`);
      res.json({ success: true, message: 'Review updated successfully', review: updated });
    } catch (error) {
      console.error('Error updating review:', error);
      res.status(500).json({ error: 'Failed to update review' });
    }
  });

  return router;
}

module.exports = createRouter;
