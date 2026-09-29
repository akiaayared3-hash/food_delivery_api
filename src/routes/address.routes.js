import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getUserAddress,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controller/address.controller.js";

const router = express.Router();

// ALL address routes must run through authenticate middleware
router.use(authenticate);

router.get("/", getUserAddress);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);

export default router;
