export function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Something went wrong on the server';
  return res.status(status).json({ error: message });
}

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default { errorHandler, ApiError };
