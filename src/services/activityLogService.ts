import { activityLogRepository } from "../repositories/activityLogRepository";
import { logger } from "../config/logger";

export class ActivityLogService {
  async log(userId: string | null, action: string, details?: any, ipAddress?: string) {
    try {
      const detailsStr = details ? JSON.stringify(details) : undefined;
      await activityLogRepository.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action,
        details: detailsStr,
        ipAddress,
      });
      logger.info(`Audit Log: User ${userId || "SYSTEM"} performed action: ${action}`);
    } catch (error) {
      logger.error("Failed to create audit log: %O", error);
    }
  }

  async getLogs() {
    return activityLogRepository.findAll();
  }
}

export const activityLogService = new ActivityLogService();
