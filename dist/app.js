"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const vendorRoutes_1 = __importDefault(require("./routes/vendorRoutes"));
const rfqRoutes_1 = __importDefault(require("./routes/rfqRoutes"));
const quotationRoutes_1 = __importDefault(require("./routes/quotationRoutes"));
const poRoutes_1 = __importDefault(require("./routes/poRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./config/logger");
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: "http://localhost:5173", // Vite default port
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Request logging middleware
app.use((req, _res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`);
    next();
});
// Static files for PDFs
app.use("/static", express_1.default.static(path_1.default.join(process.cwd(), "public")));
// Routes
app.use("/api/auth", authRoutes_1.default);
app.use("/api/vendors", vendorRoutes_1.default);
app.use("/api/rfqs", rfqRoutes_1.default);
app.use("/api/quotations", quotationRoutes_1.default);
app.use("/api/purchase-orders", poRoutes_1.default);
app.use("/api/analytics", analyticsRoutes_1.default);
// Root path response
app.get("/", (_req, res) => {
    res.json({ message: "VendorBridge ERP API is running." });
});
// Error Handler Middleware
app.use(errorHandler_1.errorHandler);
exports.default = app;
