"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const mailer_1 = require("./config/mailer");
const logger_1 = require("./config/logger");
const db_1 = require("./config/db");
const PORT = process.env.PORT || 5000;
async function startServer() {
    try {
        // Test database connection
        await db_1.prisma.$connect();
        logger_1.logger.info("Successfully connected to the database.");
        // Initialize Ethereal mailer if no real SMTP exists
        await (0, mailer_1.initMailer)();
        app_1.default.listen(PORT, () => {
            logger_1.logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
        });
    }
    catch (error) {
        logger_1.logger.error("Failed to start server: %O", error);
        process.exit(1);
    }
}
startServer();
