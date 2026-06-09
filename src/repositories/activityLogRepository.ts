import { ActivityLog, Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export class ActivityLogRepository {
  async create(data: Prisma.ActivityLogCreateInput): Promise<ActivityLog> {
    return prisma.activityLog.create({
      data,
    });
  }

  async findAll(limit = 100): Promise<ActivityLog[]> {
    return prisma.activityLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }
}
export const activityLogRepository = new ActivityLogRepository();
