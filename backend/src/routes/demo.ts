/**
 * Demo Mode Routes
 * 
 * API endpoints for demo mode information and status.
 * 
 * Demo mode allows users to interact with test data (Test-suffixed tables)
 * without affecting production data.
 * 
 * Current implementation requires server restart to switch modes.
 * Set TABLE_STORAGE_TABLE_SUFFIX=Test and restart to enable demo mode.
 */

import express from 'express';

const router = express.Router();

/**
 * GET /api/demo/status
 * 
 * Get current demo mode status and configuration
 * 
 * Response:
 * {
 *   "isDemo": boolean,           // Whether test tables are currently active
 *   "tableSuffix": string,        // Current table suffix
 *   "environment": string,        // NODE_ENV value
 *   "demoAvailable": boolean,     // Whether demo mode can be enabled
 *   "instructions": string        // How to enable demo mode
 * }
 */
router.get('/status', (req, res) => {
  try {
    const tableSuffix = process.env.TABLE_STORAGE_TABLE_SUFFIX || '';
    const isDemo = tableSuffix === 'Test' || tableSuffix === 'test';
    const environment = process.env.NODE_ENV || 'development';
    const isDemoAvailable = process.env.DEMO_MODE_ENABLED !== 'false';
    
    // Instructions for enabling demo mode
    let instructions = '';
    if (!isDemo && isDemoAvailable) {
      instructions = 'To enable demo mode, set TABLE_STORAGE_TABLE_SUFFIX=Test environment variable and restart the server.';
    } else if (!isDemoAvailable) {
      instructions = 'Demo mode is disabled. Set DEMO_MODE_ENABLED=true to enable.';
    } else {
      instructions = 'Demo mode is currently active. Using test data tables.';
    }
    
    res.json({
      isDemo,
      tableSuffix,
      environment,
      demoAvailable: isDemoAvailable,
      instructions,
    });
  } catch (error) {
    console.error('Error getting demo mode status:', error);
    res.status(500).json({
      error: 'Failed to get demo mode status',
      isDemo: false,
      demoAvailable: false,
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
                   'affecting production records.',
      testData: {
        members: 20,
        activities: 5,
        appliances: 3,
        description: 'Test tables include sample members (John Smith, Sarah Johnson, etc.), ' +
                     'standard activities (Training, Maintenance, Meeting), and sample appliances ' +
                     '(1.1 CAT 1, 1.7 CAT 7, 1.9 CAT 9).'
      },
      technicalDetails: {
        tablePrefix: process.env.TABLE_STORAGE_TABLE_PREFIX || '(none)',
        tableSuffix: process.env.TABLE_STORAGE_TABLE_SUFFIX || '(none)',
        exampleTableName: `${process.env.TABLE_STORAGE_TABLE_PREFIX || ''}Members${process.env.TABLE_STORAGE_TABLE_SUFFIX || ''}`,
        seedCommand: 'npm run seed:test (run from backend directory)'
      }
    });
  } catch (error) {
    console.error('Error getting demo mode info:', error);
    res.status(500).json({
      error: 'Failed to get demo mode info'
    });
  }
});

export default router;
