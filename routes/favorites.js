const express = require('express');

function createRouter({ db, requireAuth }) {
  const router = express.Router();

  // Add a favorite (requires auth)
  router.post('/api/favorites', requireAuth, async (req, res) => {
    try {
      if (!db.addFavorite) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const { restaurantId, restaurantName, restaurantData } = req.body;

      if (!restaurantId || !restaurantName) {
        return res.status(400).json({ error: 'restaurantId and restaurantName are required' });
      }

      const favorite = await db.addFavorite(req.userId, restaurantId, restaurantName, restaurantData || {});

      if (!favorite) {
        return res.json({ success: true, message: 'Already favorited' });
      }

      console.log(`[OK] Favorite added: ${restaurantName} by user ${req.userId}`);
      res.json({ success: true, favorite });
    } catch (error) {
      console.error('[ERROR] Error adding favorite:', error);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });

  // Remove a favorite (requires auth)
  router.delete('/api/favorites/:restaurantId', requireAuth, async (req, res) => {
    try {
      if (!db.removeFavorite) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const removed = await db.removeFavorite(req.userId, req.params.restaurantId);

      if (!removed) {
        return res.status(404).json({ error: 'Favorite not found' });
      }

      console.log(`[OK] Favorite removed: ${req.params.restaurantId} by user ${req.userId}`);
      res.json({ success: true, message: 'Favorite removed' });
    } catch (error) {
      console.error('[ERROR] Error removing favorite:', error);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  // Get all user favorites (requires auth)
  router.get('/api/favorites', requireAuth, async (req, res) => {
    try {
      if (!db.getUserFavorites) {
        return res.status(500).json({ error: 'Database not initialized', favorites: [] });
      }

      const favorites = await db.getUserFavorites(req.userId);
      res.json({ favorites });
    } catch (error) {
      console.error('[ERROR] Error fetching favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites', favorites: [] });
    }
  });

  // Check if a restaurant is favorited (requires auth)
  router.get('/api/favorites/check/:restaurantId', requireAuth, async (req, res) => {
    try {
      if (!db.isFavorite) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const favorited = await db.isFavorite(req.userId, req.params.restaurantId);
      res.json({ favorited });
    } catch (error) {
      console.error('[ERROR] Error checking favorite:', error);
      res.status(500).json({ error: 'Failed to check favorite' });
    }
  });

  return router;
}

module.exports = createRouter;
