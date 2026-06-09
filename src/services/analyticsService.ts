import { prisma } from "../config/db";
import { POStatus, RFQStatus } from "@prisma/client";

export class AnalyticsService {
  async getSpendAnalytics() {
    // Total monthly spend for APPROVED Purchase Orders
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        status: POStatus.APPROVED,
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    const monthlySpend: { [key: string]: number } = {};

    pos.forEach((po) => {
      const date = new Date(po.createdAt);
      const monthYear = date.toLocaleString("default", { month: "short", year: "numeric" });
      monthlySpend[monthYear] = (monthlySpend[monthYear] || 0) + Number(po.totalAmount);
    });

    return Object.entries(monthlySpend).map(([month, amount]) => ({
      month,
      spend: parseFloat(amount.toFixed(2)),
    }));
  }

  async getVendorPerformance() {
    // Vendors with ratings and count of quotes/selections
    const vendors = await prisma.vendor.findMany({
      include: {
        quotations: {
          select: {
            status: true,
            deliveryTimeline: true,
          },
        },
      },
    });

    return vendors.map((vendor) => {
      const totalQuotes = vendor.quotations.length;
      const selectedQuotes = vendor.quotations.filter((q) => q.status === "SELECTED").length;
      
      const successRate = totalQuotes > 0 ? (selectedQuotes / totalQuotes) * 100 : 0;
      
      const avgTimeline =
        vendor.quotations.length > 0
          ? vendor.quotations.reduce((acc, q) => acc + q.deliveryTimeline, 0) / vendor.quotations.length
          : 0;

      return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        rating: vendor.rating,
        totalQuotes,
        selectedQuotes,
        successRate: parseFloat(successRate.toFixed(2)),
        averageDeliveryDays: parseFloat(avgTimeline.toFixed(1)),
      };
    });
  }

  async getRFQStats() {
    const counts = await prisma.rFQ.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    const totalRFQs = await prisma.rFQ.count();

    const stats: { [key in RFQStatus]?: number } = {};
    counts.forEach((c) => {
      stats[c.status] = c._count.status;
    });

    return {
      total: totalRFQs,
      byStatus: stats,
    };
  }

  async getApprovalMetrics() {
    const approvedCount = await prisma.purchaseOrder.count({
      where: { status: POStatus.APPROVED },
    });

    const rejectedCount = await prisma.purchaseOrder.count({
      where: { status: POStatus.REJECTED },
    });

    const pendingCount = await prisma.purchaseOrder.count({
      where: { status: POStatus.PENDING_APPROVAL },
    });

    // Average approval time
    const approvedPOs = await prisma.purchaseOrder.findMany({
      where: {
        status: POStatus.APPROVED,
        approvedAt: { not: null },
      },
      select: {
        createdAt: true,
        approvedAt: true,
      },
    });

    let totalDurationMs = 0;
    approvedPOs.forEach((po) => {
      if (po.approvedAt) {
        totalDurationMs += new Date(po.approvedAt).getTime() - new Date(po.createdAt).getTime();
      }
    });

    const avgApprovalTimeHours =
      approvedPOs.length > 0 ? totalDurationMs / (1000 * 60 * 60 * approvedPOs.length) : 0;

    return {
      approvedCount,
      rejectedCount,
      pendingCount,
      avgApprovalTimeHours: parseFloat(avgApprovalTimeHours.toFixed(2)),
    };
  }
}

export const analyticsService = new AnalyticsService();
