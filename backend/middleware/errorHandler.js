export function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorStack]', err.stack || err);
  } else {
    console.error('[ServerError]', err.message);
  }

  const status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // In production, mask unhandled 500 internal errors to prevent information disclosure
  if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error. Please try again later.';
  }

  return res.status(status).json({
    success: false,
    error: message,
    message: message, // Support both error and message fields for all frontend consumers
  });
}


export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default { errorHandler, ApiError };
