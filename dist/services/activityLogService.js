"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityLogService = exports.ActivityLogService = void 0;
const activityLogRepository_1 = require("../repositories/activityLogRepository");
const logger_1 = require("../config/logger");
class ActivityLogService {
    async log(userId, action, details, ipAddress) {
        try {
            const detailsStr = details ? JSON.stringify(details) : undefined;
            await activityLogRepository_1.activityLogRepository.create({
                user: userId ? { connect: { id: userId } } : undefined,
                action,
                details: detailsStr,
                ipAddress,
            });
            logger_1.logger.info(`Audit Log: User ${userId || "SYSTEM"} performed action: ${action}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to create audit log: %O", error);
        }
    }
    async getLogs() {
        return activityLogRepository_1.activityLogRepository.findAll();
    }
}
exports.ActivityLogService = ActivityLogService;
exports.activityLogService = new ActivityLogService();
