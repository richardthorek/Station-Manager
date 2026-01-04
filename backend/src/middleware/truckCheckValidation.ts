/**
 * Truck Checks Validation Middleware
 * 
 * Validation rules for truck checks (vehicle inspection) endpoints:
 * - Appliance management
 * - Checklist templates
 * - Check runs
 * - Check results
 * - Photo uploads
 * - Protecting against XSS attacks
 */

import { body, param, query } from 'express-validator';

// ============================================
// Appliance Validation
// ============================================

/**
 * Validation for creating an appliance
 * POST /api/truck-checks/appliances
 */
export const validateCreateAppliance = [
  body('name')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Appliance name must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('photoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Photo URL must be a valid URL')
    .isLength({ max: 2000 })
    .withMessage('Photo URL must not exceed 2000 characters'),
];

/**
 * Validation for updating an appliance
 * PUT /api/truck-checks/appliances/:id
 */
export const validateUpdateAppliance = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance ID is required')
    .isLength({ max: 100 })
    .withMessage('Appliance ID is invalid'),
  
  body('name')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Appliance name must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('photoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Photo URL must be a valid URL')
    .isLength({ max: 2000 })
    .withMessage('Photo URL must not exceed 2000 characters'),
];

/**
 * Validation for appliance ID parameter
 * GET /api/truck-checks/appliances/:id
 * DELETE /api/truck-checks/appliances/:id
 */
export const validateApplianceId = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance ID is required')
    .isLength({ max: 100 })
    .withMessage('Appliance ID is invalid'),
];

// ============================================
// Template Validation
// ============================================

/**
 * Validation for template appliance ID parameter
 * GET /api/truck-checks/templates/:applianceId
 * PUT /api/truck-checks/templates/:applianceId
 */
export const validateTemplateApplianceId = [
  param('applianceId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance ID is required')
    .isLength({ max: 100 })
    .withMessage('Appliance ID is invalid'),
];

/**
 * Validation for updating a checklist template
 * PUT /api/truck-checks/templates/:applianceId
 */
export const validateUpdateTemplate = [
  param('applianceId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance ID is required')
    .isLength({ max: 100 })
    .withMessage('Appliance ID is invalid'),
  
  body('items')
    .isArray({ min: 0 })
    .withMessage('Items must be an array'),
  
  body('items.*.id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Item ID is required')
    .isLength({ max: 100 })
    .withMessage('Item ID is invalid'),
  
  body('items.*.name')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Item name must be between 1 and 200 characters'),
  
  body('items.*.description')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 1000 })
    .withMessage('Item description must not exceed 1000 characters'),
  
  body('items.*.referencePhotoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Reference photo URL must be a valid URL')
    .isLength({ max: 2000 })
    .withMessage('Reference photo URL must not exceed 2000 characters'),
];

// ============================================
// Check Run Validation
// ============================================

/**
 * Validation for creating/joining a check run
 * POST /api/truck-checks/runs
 */
export const validateCreateCheckRun = [
  body('applianceId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Appliance ID is required')
    .isLength({ max: 100 })
    .withMessage('Appliance ID is invalid'),
  
  body('completedBy')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('CompletedBy is required')
    .isLength({ max: 100 })
    .withMessage('CompletedBy is invalid'),
  
  body('completedByName')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 200 })
    .withMessage('CompletedByName must not exceed 200 characters'),
];

/**
 * Validation for check run ID parameter
 * GET /api/truck-checks/runs/:id
 */
export const validateCheckRunId = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Check run ID is required')
    .isLength({ max: 100 })
    .withMessage('Check run ID is invalid'),
];

/**
 * Validation for completing a check run
 * PUT /api/truck-checks/runs/:id/complete
 */
export const validateCompleteCheckRun = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Check run ID is required')
    .isLength({ max: 100 })
    .withMessage('Check run ID is invalid'),
  
  body('additionalComments')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 2000 })
    .withMessage('Additional comments must not exceed 2000 characters'),
];

/**
 * Validation for check run query parameters
 * GET /api/truck-checks/runs
 */
export const validateCheckRunQuery = [
  query('applianceId')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Appliance ID is invalid'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  query('withIssues')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('withIssues must be true or false'),
];

// ============================================
// Check Result Validation
// ============================================

/**
 * Validation for creating a check result
 * POST /api/truck-checks/results
 */
export const validateCreateCheckResult = [
  body('runId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Run ID is required')
    .isLength({ max: 100 })
    .withMessage('Run ID is invalid'),
  
  body('itemId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Item ID is required')
    .isLength({ max: 100 })
    .withMessage('Item ID is invalid'),
  
  body('itemName')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Item name must be between 1 and 200 characters'),
  
  body('itemDescription')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Item description is required')
    .isLength({ max: 1000 })
    .withMessage('Item description must not exceed 1000 characters'),
  
  body('status')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['done', 'issue', 'skipped'])
    .withMessage('Status must be one of: done, issue, skipped'),
  
  body('comment')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 2000 })
    .withMessage('Comment must not exceed 2000 characters'),
  
  body('photoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Photo URL must be a valid URL')
    .isLength({ max: 2000 })
    .withMessage('Photo URL must not exceed 2000 characters'),
  
  body('completedBy')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('CompletedBy must not exceed 100 characters'),
];

/**
 * Validation for updating a check result
 * PUT /api/truck-checks/results/:id
 */
export const validateUpdateCheckResult = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Check result ID is required')
    .isLength({ max: 100 })
    .withMessage('Check result ID is invalid'),
  
  body('status')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['done', 'issue', 'skipped'])
    .withMessage('Status must be one of: done, issue, skipped'),
  
  body('comment')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 2000 })
    .withMessage('Comment must not exceed 2000 characters'),
  
  body('photoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Photo URL must be a valid URL')
    .isLength({ max: 2000 })
    .withMessage('Photo URL must not exceed 2000 characters'),
];

/**
 * Validation for check result ID parameter
 * DELETE /api/truck-checks/results/:id
 */
export const validateCheckResultId = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Check result ID is required')
    .isLength({ max: 100 })
    .withMessage('Check result ID is invalid'),
];
