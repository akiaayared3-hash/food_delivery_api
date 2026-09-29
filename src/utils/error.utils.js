/**
 * Custom Operational Application Error
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true; // Identifies known operational errors
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express Global Error Middleware
 */
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  // Handle specific MySQL errors gracefully
  if (err.code === "ER_DUP_ENTRY") {
    err.statusCode = 409;
    err.message = "Duplicate entry detected. Resource already exists.";
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    err.statusCode = 400;
    err.message = "Invalid foreign key reference.";
  }

  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
    ...(err.errors && { errors: err.errors }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
