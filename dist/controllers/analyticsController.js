"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = exports.AnalyticsController = void 0;
const analyticsService_1 = require("../services/analyticsService");
const activityLogService_1 = require("../services/activityLogService");
const response_1 = require("../utils/response");
class AnalyticsController {
    async getDashboardSummary(_req, res, next) {
        try {
            const spend = await analyticsService_1.analyticsService.getSpendAnalytics();
            const rfqStats = await analyticsService_1.analyticsService.getRFQStats();
            const vendorPerf = await analyticsService_1.analyticsService.getVendorPerformance();
            const approvals = await analyticsService_1.analyticsService.getApprovalMetrics();
            return (0, response_1.sendSuccess)(res, {
                spend,
                rfqStats,
                vendorPerformance: vendorPerf,
                approvals,
            });
        }
        catch (error) {
            return next(error);
        }
    }
    async getAuditLogs(_req, res, next) {
        try {
            const logs = await activityLogService_1.activityLogService.getLogs();
            return (0, response_1.sendSuccess)(res, logs);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.AnalyticsController = AnalyticsController;
exports.analyticsController = new AnalyticsController();
