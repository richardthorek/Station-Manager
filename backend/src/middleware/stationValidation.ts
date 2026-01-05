/**
 * Station Validation Middleware
 * 
 * Validation rules for station management endpoints:
 * - Creating new stations
 * - Updating station information
 * - Protecting against XSS attacks
 * - Ensuring data quality and valid hierarchy structure
 */

import { body, param, query } from 'express-validator';

/**
 * Validation for station hierarchy structure
 */
const hierarchyValidation = [
  body('hierarchy.jurisdiction')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Jurisdiction is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Jurisdiction must be between 1 and 100 characters'),
  
  body('hierarchy.area')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Area is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Area must be between 1 and 100 characters'),
  
  body('hierarchy.district')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('District is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('District must be between 1 and 100 characters'),
  
  body('hierarchy.brigade')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Brigade is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Brigade must be between 1 and 100 characters'),
  
  body('hierarchy.station')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Station is required in hierarchy')
    .isLength({ min: 1, max: 100 })
    .withMessage('Station must be between 1 and 100 characters'),
];

/**
 * Validation for creating a new station
 * POST /api/stations
 */
export const validateCreateStation = [
  body('name')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Station name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Station name must be between 1 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-'()]+$/)
    .withMessage('Station name can only contain letters, numbers, spaces, hyphens, apostrophes, and parentheses'),
  
  body('brigadeId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Brigade ID is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Brigade ID must be between 1 and 100 characters'),
  
  body('brigadeName')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Brigade name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Brigade name must be between 1 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-'()]+$/)
    .withMessage('Brigade name can only contain letters, numbers, spaces, hyphens, apostrophes, and parentheses'),
  
  ...hierarchyValidation,
  
  // Optional location fields
  body('location.address')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  // Optional contact info
  body('contactInfo.phone')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 50 })
    .withMessage('Phone number must not exceed 50 characters')
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses'),
  
  body('contactInfo.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 200 })
    .withMessage('Email must not exceed 200 characters'),
];

/**
 * Validation for updating a station
 * PUT /api/stations/:id
 */
export const validateUpdateStation = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Station ID is required')
    .isLength({ max: 100 })
    .withMessage('Station ID is invalid'),
  
  body('name')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 200 })
    .withMessage('Station name must be between 1 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-'()]+$/)
    .withMessage('Station name can only contain letters, numbers, spaces, hyphens, apostrophes, and parentheses'),
  
  body('brigadeName')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 200 })
    .withMessage('Brigade name must be between 1 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-'()]+$/)
    .withMessage('Brigade name can only contain letters, numbers, spaces, hyphens, apostrophes, and parentheses'),
  
  // Optional hierarchy updates
  body('hierarchy.jurisdiction')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('Jurisdiction must be between 1 and 100 characters'),
  
  body('hierarchy.area')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('Area must be between 1 and 100 characters'),
  
  body('hierarchy.district')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('District must be between 1 and 100 characters'),
  
  body('hierarchy.brigade')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('Brigade must be between 1 and 100 characters'),
  
  body('hierarchy.station')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('Station must be between 1 and 100 characters'),
  
  // Optional location fields
  body('location.address')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  // Optional contact info
  body('contactInfo.phone')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 50 })
    .withMessage('Phone number must not exceed 50 characters')
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses'),
  
  body('contactInfo.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 200 })
    .withMessage('Email must not exceed 200 characters'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

/**
 * Validation for getting a station by ID
 * GET /api/stations/:id
 * DELETE /api/stations/:id
 */
export const validateStationId = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Station ID is required')
    .isLength({ max: 100 })
    .withMessage('Station ID is invalid'),
];

/**
 * Validation for getting stations by brigade
 * GET /api/stations/brigade/:brigadeId
 */
export const validateBrigadeId = [
  param('brigadeId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Brigade ID is required')
    .isLength({ max: 100 })
    .withMessage('Brigade ID is invalid'),
];

/**
 * Validation for query parameters
 * GET /api/stations
 */
export const validateStationQuery = [
  query('brigadeId')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Brigade ID is invalid'),
  
  query('area')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Area is invalid'),
  
  query('district')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('District is invalid'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be 0 or greater'),
];
