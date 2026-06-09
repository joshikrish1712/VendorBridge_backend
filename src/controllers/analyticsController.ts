import { Response, NextFunction } from "express";
import { analyticsService } from "../services/analyticsService";
import { activityLogService } from "../services/activityLogService";
import { sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../middleware/auth";

export class AnalyticsController {
  async getDashboardSummary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const spend = await analyticsService.getSpendAnalytics();
      const rfqStats = await analyticsService.getRFQStats();
      const vendorPerf = await analyticsService.getVendorPerformance();
      const approvals = await analyticsService.getApprovalMetrics();

      return sendSuccess(res, {
        spend,
        rfqStats,
        vendorPerformance: vendorPerf,
        approvals,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAuditLogs(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const logs = await activityLogService.getLogs();
      return sendSuccess(res, logs);
    } catch (error) {
      return next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
