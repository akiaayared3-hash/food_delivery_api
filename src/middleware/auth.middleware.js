import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/index.utils.js";

const JWT_SECRET =
  env?.JWT_SECRET ||
  process.env.JWT_SECRET ||
  "super_secret_jwt_key_change_in_prod";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Authentication token missing or invalid", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role }
    return next();
  } catch (error) {
    // Log the actual error to your Node terminal to catch signature/expiration issues instantly
    console.error("❌ JWT Verification Failed:", error.message);
    return next(new AppError("Invalid or expired token", 401));
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("Access forbidden: Insufficient permissions", 403),
      );
    }
    return next();
  };
};

export { authenticate, authorize };
