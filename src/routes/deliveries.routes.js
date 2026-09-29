import { Router } from "express";
import {
  assignDriver,
  updateLocation,
  updateDeliveryStatus,
  getDeliveryByOrderId,
} from "../controller/deliveries.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// Protect all delivery endpoints
router.use(authenticate);

// 1. Direct Delivery creation / Assign Driver -> handles POST /api/v1/deliveries
router.post("/", authorize("driver", "admin"), assignDriver);

// 2. Explicit Assign route -> handles POST /api/v1/deliveries/assign
router.post("/assign", authorize("driver", "admin"), assignDriver);

// 3. Driver: Update live GPS coordinates -> handles PATCH /api/v1/deliveries/:id/location
router.patch("/:id/location", authorize("driver"), updateLocation);

// 4. Driver: Update lifecycle status -> handles PATCH /api/v1/deliveries/:id/status
router.patch("/:id/status", authorize("driver"), updateDeliveryStatus);

// 5. Track delivery by Order ID -> handles GET /api/v1/deliveries/orders/:orderId
router.get("/orders/:orderId", getDeliveryByOrderId);

export default router;
