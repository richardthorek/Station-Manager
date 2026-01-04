/**
 * Event Validation Middleware
 * 
 * Validation rules for event-related endpoints:
 * - Creating events
 * - Adding participants
 * - Managing event lifecycle
 * - Protecting against XSS attacks
 */

import { body, param, query } from 'express-validator';

/**
 * Validation for creating an event
 * POST /api/events
 */
export const validateCreateEvent = [
  body('activityId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Activity ID is required')
    .isLength({ max: 100 })
    .withMessage('Activity ID is invalid'),
  
  body('createdBy')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 200 })
    .withMessage('CreatedBy must not exceed 200 characters'),
];

/**
 * Validation for event ID parameter
 * Used in GET /api/events/:eventId, PUT /api/events/:eventId/end
 */
export const validateEventId = [
  param('eventId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Event ID is required')
    .isLength({ max: 100 })
    .withMessage('Event ID is invalid'),
];

/**
 * Validation for adding a participant to an event
 * POST /api/events/:eventId/participants
 */
export const validateAddParticipant = [
  param('eventId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Event ID is required')
    .isLength({ max: 100 })
    .withMessage('Event ID is invalid'),
  
  body('memberId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Member ID is required')
    .isLength({ max: 100 })
    .withMessage('Member ID is invalid'),
  
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
 * Validation for removing a participant
 * DELETE /api/events/:eventId/participants/:participantId
 */
export const validateRemoveParticipant = [
  param('eventId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Event ID is required')
    .isLength({ max: 100 })
    .withMessage('Event ID is invalid'),
  
  param('participantId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Participant ID is required')
    .isLength({ max: 100 })
    .withMessage('Participant ID is invalid'),
];

/**
 * Validation for event query parameters
 * GET /api/events?limit=50&offset=0
 * 
 * Note: Limits are capped at 100 to prevent excessive database queries
 * and maintain reasonable response times. Offsets are sanitized to be non-negative.
 */
export const validateEventQuery = [
  query('limit')
    .optional()
    .toInt()
    .isInt({ min: 1 })
    .withMessage('Limit must be at least 1')
    .customSanitizer((value) => Math.min(value, 100)), // Cap at 100 for performance
  
  query('offset')
    .optional()
    .toInt()
    .customSanitizer((value) => Math.max(value, 0)), // Ensure non-negative
];
