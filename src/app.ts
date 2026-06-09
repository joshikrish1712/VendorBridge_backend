import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/authRoutes";
import vendorRoutes from "./routes/vendorRoutes";
import rfqRoutes from "./routes/rfqRoutes";
import quotationRoutes from "./routes/quotationRoutes";
import poRoutes from "./routes/poRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./config/logger";

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Dynamic for production deployment
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Static files for PDFs
app.use("/static", express.static(path.join(process.cwd(), "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/purchase-orders", poRoutes);
app.use("/api/analytics", analyticsRoutes);

// Root path response
app.get("/", (_req, res) => {
  res.json({ message: "VendorBridge ERP API is running." });
});

// Error Handler Middleware
app.use(errorHandler);

export default app;
