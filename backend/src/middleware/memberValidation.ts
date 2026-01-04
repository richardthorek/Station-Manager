/**
 * Member Validation Middleware
 * 
 * Validation rules for member-related endpoints:
 * - Creating new members
 * - Updating member information
 * - Protecting against XSS attacks
 * - Ensuring data quality
 */

import { body, param } from 'express-validator';

/**
 * Validation for creating a new member
 * POST /api/members
 * At least one of: name, firstName, or (firstName + lastName) must be provided
 */
export const validateCreateMember = [
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .escape()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  
  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string')
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string')
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('preferredName')
    .optional()
    .isString()
    .withMessage('Preferred name must be a string')
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage('Preferred name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Preferred name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('rank')
    .optional()
    .isString()
    .withMessage('Rank must be a string')
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Rank must not exceed 100 characters'),

  body('memberNumber')
    .optional()
    .isString()
    .withMessage('Member number must be a string')
    .trim()
    .escape()
    .isLength({ max: 50 })
    .withMessage('Member number must not exceed 50 characters'),
  
  // Custom validator to ensure at least one name field is provided and valid
  body().custom((value, { req }) => {
    const { name, firstName, lastName, preferredName } = req.body || {};
    const clean = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
    
    const hasValidName = clean(name).length > 0;
    const hasValidFirstName = clean(firstName).length > 0;
    const hasValidLastName = clean(lastName).length > 0;
    const hasValidPreferredName = clean(preferredName).length > 0;
    
    // Need at least one valid name field
    if (!hasValidName && !hasValidFirstName && !hasValidPreferredName && !hasValidLastName) {
      throw new Error('Valid name is required (provide name, firstName, preferredName, or lastName)');
    }
    
    return true;
  }),
];

/**
 * Validation for updating a member
 * PUT /api/members/:id
 */
export const validateUpdateMember = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Member ID is required')
    .isLength({ max: 100 })
    .withMessage('Member ID is invalid'),
  
  body('name')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  
  body('rank')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 })
    .withMessage('Rank must not exceed 100 characters'),
];

/**
 * Validation for getting a member by ID
 * GET /api/members/:id
 */
export const validateMemberId = [
  param('id')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('Member ID is required')
    .isLength({ max: 100 })
    .withMessage('Member ID is invalid'),
];

/**
 * Validation for getting a member by QR code
 * GET /api/members/qr/:qrCode
 */
export const validateQRCode = [
  param('qrCode')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('QR code is required')
    .isLength({ max: 100 })
    .withMessage('QR code is invalid'),
];
