"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorRepository = void 0;
const db_1 = require("../config/db");
class VendorRepository {
    async findById(id) {
        return db_1.prisma.vendor.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        isActive: true,
                    },
                },
            },
        });
    }
    async findByEmail(email) {
        return db_1.prisma.vendor.findUnique({
            where: { email },
        });
    }
    async create(data) {
        return db_1.prisma.vendor.create({
            data,
        });
    }
    async update(id, data) {
        return db_1.prisma.vendor.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        return db_1.prisma.vendor.delete({
            where: { id },
        });
    }
    async findAll(filters = {}) {
        const whereClause = {};
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.category) {
            whereClause.categories = {
                has: filters.category,
            };
        }
        return db_1.prisma.vendor.findMany({
            where: whereClause,
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
}
exports.VendorRepository = VendorRepository;
