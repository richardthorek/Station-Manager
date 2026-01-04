/**
 * Validation Middleware Handler
 * 
 * Common utility to handle validation errors from express-validator.
 * Returns clear, structured error messages for validation failures.
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError, FieldValidationError } from 'express-validator';

interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Middleware to check validation results and return errors if any
 * Should be used after validation chains
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors: ValidationErrorDetail[] = errors.array().map((error: ValidationError) => ({
      field: error.type === 'field' ? (error as FieldValidationError).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as FieldValidationError).value : undefined,
    }));
    
    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors,
    });
    return;
  }
  
  next();
};
