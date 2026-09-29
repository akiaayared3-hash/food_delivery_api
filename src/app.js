import "dotenv/config"; // MUST BE ON LINE 1 BEFORE ALL OTHER IMPORTS
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pool from "./config/db.js";
import { initDb } from "./config/initDb.js";
import { errorHandler } from "./utils/error.utils.js";

// Route Imports
import authRoutes from "./routes/auth.routes.js";
import addressRoutes from "./routes/address.routes.js";
import restaurantRoutes from "./routes/restaurant.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import deliveryRoutes from "./routes/deliveries.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

const app = express();

// Security & Parsing Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Route
app.get("/", (req, res) => {
  res.send("API is working");
});

// API V1 Route Mounting
const API_PREFIX = "/api/v1";

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/addresses`, addressRoutes);
app.use(`${API_PREFIX}/restaurants`, restaurantRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/deliveries`, deliveryRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// Centralized Error Handler
app.use(errorHandler);

const startServer = async () => {
  try {
    await initDb();

    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL Database successfully.");
    connection.release();

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`🚀 Server listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
