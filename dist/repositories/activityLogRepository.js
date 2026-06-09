"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityLogRepository = exports.ActivityLogRepository = void 0;
const db_1 = require("../config/db");
class ActivityLogRepository {
    async create(data) {
        return db_1.prisma.activityLog.create({
            data,
        });
    }
    async findAll(limit = 100) {
        return db_1.prisma.activityLog.findMany({
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
exports.ActivityLogRepository = ActivityLogRepository;
exports.activityLogRepository = new ActivityLogRepository();
