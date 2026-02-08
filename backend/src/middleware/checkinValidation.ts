/**
 * Check-in Validation Middleware
 * 
 * Validation rules for check-in/check-out endpoints:
 * - Creating check-ins
 * - URL-based check-ins
 * - Undo check-ins
 * - Protecting against XSS attacks
 */

import { body, param } from 'express-validator';

/**
 * Validation for creating a check-in
 * POST /api/checkins
 */
export const validateCreateCheckIn = [
  body('memberId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Member ID is required')
    .isLength({ max: 100 })
    .withMessage('Member ID is invalid'),
  
  body('activityId')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Activity ID is invalid'),
  
  body('method')
    .optional()
    .trim()
    .escape()
    .isIn(['kiosk', 'mobile', 'qr', 'manual'])
    .withMessage('Method must be one of: kiosk, mobile, qr, manual'),
  
  body('location')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 500 })
    .withMessage('Location must not exceed 500 characters'),
  
  body('isOffsite')
    .optional()
    .isBoolean()
    .withMessage('isOffsite must be a boolean'),
];

/**
 * Validation for URL-based check-in
 * POST /api/checkins/url-checkin
 */
export const validateUrlCheckIn = [
  body('identifier')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('User identifier is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Identifier must be between 1 and 500 characters'),
  body('stationId')
    .optional()
    .trim()
    .isString()
    .withMessage('Station ID must be a string'),
];

/**
 * Validation for undoing check-in by member ID
 * DELETE /api/checkins/:memberId
 */
export const validateMemberIdParam = [
  param('memberId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Member ID is required')
    .isLength({ max: 100 })
    .withMessage('Member ID is invalid'),
];
