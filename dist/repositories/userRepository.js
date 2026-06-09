"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const db_1 = require("../config/db");
class UserRepository {
    async findByEmail(email) {
        return db_1.prisma.user.findUnique({
            where: { email },
            include: {
                vendorProfile: true,
            },
        });
    }
    async findById(id) {
        return db_1.prisma.user.findUnique({
            where: { id },
            include: {
                vendorProfile: true,
            },
        });
    }
    async create(data) {
        return db_1.prisma.user.create({
            data,
            include: {
                vendorProfile: true,
            },
        });
    }
    async update(id, data) {
        return db_1.prisma.user.update({
            where: { id },
            data,
            include: {
                vendorProfile: true,
            },
        });
    }
    async delete(id) {
        return db_1.prisma.user.delete({
            where: { id },
        });
    }
    async findAll(where) {
        return db_1.prisma.user.findMany({
            where,
            include: {
                vendorProfile: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
}
exports.UserRepository = UserRepository;
