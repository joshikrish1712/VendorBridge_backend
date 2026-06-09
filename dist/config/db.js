"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
exports.prisma = new client_1.PrismaClient({
    log: [
        { level: "query", emit: "event" },
        { level: "info", emit: "stdout" },
        { level: "warn", emit: "stdout" },
        { level: "error", emit: "stdout" },
    ],
});
// Log raw queries in development
if (process.env.NODE_ENV === "development") {
    exports.prisma.$on("query", (e) => {
        logger_1.logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
    });
}
