/**
 * Demo Mode Routes
 * 
 * API endpoints for demo mode information and status.
 * 
 * Demo mode allows users to interact with test data (Test-suffixed tables)
 * without affecting production data. With the dual-instance implementation,
 * demo mode can be toggled per-device/per-request via ?demo=true parameter.
 */

import express from 'express';
import { logger } from '../services/logger';

const router = express.Router();

/**
 * GET /api/demo/status
 * 
 * Get current demo mode status for this request
 * 
 * Response:
 * {
 *   "isDemo": boolean,           // Whether this request is in demo mode
 *   "demoAvailable": boolean,     // Whether demo mode can be enabled
 *   "perDeviceMode": boolean,     // Whether per-device demo mode is active
 *   "instructions": string        // How to use demo mode
 * }
 */
router.get('/status', (req, res) => {
  try {
    const isDemo = req.isDemoMode || false;
    const isDemoAvailable = process.env.DEMO_MODE_ENABLED !== 'false';
    
    // Instructions for enabling demo mode
    let instructions = '';
    if (!isDemoAvailable) {
      instructions = 'Demo mode is disabled. Set DEMO_MODE_ENABLED=true to enable.';
    } else if (isDemo) {
      instructions = 'Demo mode is currently active for this request. You are viewing test data. Remove ?demo=true from the URL to return to production data.';
    } else {
      instructions = 'Demo mode is available. Add ?demo=true to the URL to view test data without affecting production records.';
    }
    
    res.json({
      isDemo,
      demoAvailable: isDemoAvailable,
      perDeviceMode: true, // This implementation supports per-device mode
      instructions,
    });
  } catch (error) {
    logger.error('Error getting demo mode status:', error);
    res.status(500).json({
      error: 'Failed to get demo mode status',
      isDemo: false,
      demoAvailable: false,
      perDeviceMode: false,
    });
  }
});

/**
 * GET /api/demo/info
 * 
 * Get information about demo mode and test data
 * 
 * Response:
 * {
 *   "description": string,       // Description of demo mode
 *   "testData": {                // Information about test data
 *     "members": number,         // Approximate count
 *     "activities": number,      // Approximate count
 *     "description": string
 *   }
 * }
 */
router.get('/info', (req, res) => {
  try {
    res.json({
      description: 'Demo mode uses test data from Table Storage tables suffixed with "Test". ' +
                   'This allows you to explore the system with pre-populated sample data without ' +
                   'affecting production records. With per-device mode, each device can independently ' +
                   'toggle between production and test data by adding or removing ?demo=true from the URL.',
      features: [
        'Per-device control - each browser/device can independently enable demo mode',
        'No server restart required - toggle instantly via URL parameter',
        'Dual database instances - production and test data maintained separately',
        'Real-time synchronization - demo mode works with all real-time features',
      ],
      testData: {
        members: 20,
        activities: 5,
        appliances: 3,
        description: 'Test tables include sample members (John Smith, Sarah Johnson, etc.), ' +
                     'standard activities (Training, Maintenance, Meeting, Brigade Training, District Training), ' +
                     'and sample appliances (1.1 CAT 1, 1.7 CAT 7, 1.9 CAT 9).'
      },
      usage: {
        activate: 'Add ?demo=true to any URL (e.g., http://localhost:3000/?demo=true)',
        deactivate: 'Remove ?demo=true from URL or navigate without the parameter',
        seedData: 'Run "npm run seed:test" from backend directory to populate test tables'
      }
    });
  } catch (error) {
    logger.error('Error getting demo mode info:', error);
    res.status(500).json({
      error: 'Failed to get demo mode info'
    });
  }
});

export default router;
