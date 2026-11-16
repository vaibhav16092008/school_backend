import { Response } from 'express';

export interface ApiResponseOptions<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: any;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200,
  meta?: any
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
}

export function sendError(
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: details,
  });
}

