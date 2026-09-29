import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} from "../controller/orders.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// Require authentication for all order operations
router.use(authenticate);

// Customer endpoints
router.post("/", authorize("customer"), createOrder);
router.get("/me", authorize("customer"), getMyOrders);
router.get("/:id", getOrderById);

// Status transition endpoints (Owners, Drivers, Admin)
router.patch(
  "/:id/status",
  authorize("restaurant_owner", "driver", "admin"),
  updateOrderStatus,
);

export default router;
