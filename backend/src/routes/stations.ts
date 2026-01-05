import express from 'express';
import { getRFSFacilitiesParser } from '../services/rfsFacilitiesParser';

const router = express.Router();

/**
 * GET /api/stations/lookup
 * Search and locate fire service stations from national dataset
 * Supports all Australian states and territories
 * Query params:
 *   - q: search query (station name, suburb, brigade)
 *   - lat: user latitude (for geolocation sorting)
 *   - lon: user longitude (for geolocation sorting)
 *   - limit: max results per category (default 10, max 50)
 */
router.get('/lookup', async (req, res) => {
  try {
    const query = req.query.q as string | undefined;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const parser = getRFSFacilitiesParser();
    
    // Ensure data is loaded
    await parser.loadData();

    // Validate that at least one parameter is provided
    if (!query && (lat === undefined || lon === undefined)) {
      return res.status(400).json({
        error: 'At least one of query (q) or location (lat, lon) must be provided'
      });
    }

    // Perform lookup
    const results = parser.lookup(query, lat, lon, limit);

    res.json({
      results,
      count: results.length,
      query,
      location: lat !== undefined && lon !== undefined ? { lat, lon } : undefined
    });
  } catch (error) {
    console.error('Error in station lookup:', error);
    res.status(500).json({
      error: 'Failed to lookup stations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/stations/count
 * Get count of loaded fire service stations nationally (for debugging/monitoring)
 */
router.get('/count', async (req, res) => {
  try {
    const parser = getRFSFacilitiesParser();
    await parser.loadData();
    
    res.json({
      count: parser.getCount()
    });
  } catch (error) {
    console.error('Error getting station count:', error);
    res.status(500).json({
      error: 'Failed to get station count',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
