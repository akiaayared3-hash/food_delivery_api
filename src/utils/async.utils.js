/**
 * Wraps async functions to capture thrown errors and pass them to Express error handler
 * @param {Function} fn - Async controller function
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
