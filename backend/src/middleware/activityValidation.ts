/**
 * Activity Validation Middleware
 * 
 * Validation rules for activity-related endpoints:
 * - Creating custom activities
 * - Setting active activity
 * - Protecting against XSS attacks
 */

import { body } from 'express-validator';

/**
 * Validation for creating a custom activity
 * POST /api/activities
 */
export const validateCreateActivity = [
  body('name')
    .isString()
    .withMessage('Activity name must be a string')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Activity name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Activity name must be between 1 and 200 characters'),
  
  body('createdBy')
    .optional()
    .isString()
    .withMessage('CreatedBy must be a string')
    .trim()
    .escape()
    .isLength({ max: 200 })
    .withMessage('CreatedBy must not exceed 200 characters'),
];

/**
 * Validation for setting active activity
 * POST /api/activities/active
 */
export const validateSetActiveActivity = [
  body('activityId')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Activity ID is required')
    .isLength({ max: 100 })
    .withMessage('Activity ID is invalid'),
  
  body('setBy')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 200 })
    .withMessage('SetBy must not exceed 200 characters'),
];
