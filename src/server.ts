import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { initMailer } from "./config/mailer";
import { logger } from "./config/logger";
import { prisma } from "./config/db";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("Successfully connected to the database.");

    // Initialize Ethereal mailer if no real SMTP exists
    await initMailer();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
    });
  } catch (error) {
    logger.error("Failed to start server: %O", error);
    process.exit(1);
  }
}

startServer();
