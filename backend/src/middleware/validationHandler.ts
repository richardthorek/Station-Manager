/**
 * Validation Middleware Handler
 * 
 * Common utility to handle validation errors from express-validator.
 * Returns clear, structured error messages for validation failures.
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

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
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));
    
    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors,
    });
    return;
  }
  
  next();
};
