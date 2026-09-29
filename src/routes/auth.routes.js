import express from "express";
import {
  register,
  login,
  getMe,
  createPrivilegedUser,
} from "../controller/auth.controllers.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// 🔒 Protected user route (Requires Bearer token)
router.get("/me", authenticate, getMe);

// 🛡️ Admin-only route (Requires Admin Bearer token)
router.post(
  "/admin/create-user",
  authenticate,
  authorize("admin"),
  createPrivilegedUser,
);

export default router;
