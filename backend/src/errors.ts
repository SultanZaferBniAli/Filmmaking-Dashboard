import type { ZodError } from 'zod';

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  fieldErrors: FieldError[];

  constructor(statusCode: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function zodToApiError(error: ZodError): ApiError {
  const fieldErrors: FieldError[] = error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
  return new ApiError(422, 'VALIDATION_ERROR', 'One or more fields failed validation', fieldErrors);
}

export function errorBody(err: ApiError) {
  return {
    error: {
      code: err.code,
      message: err.message,
      fieldErrors: err.fieldErrors,
    },
  };
}
