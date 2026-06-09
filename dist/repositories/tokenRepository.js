"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenRepository = void 0;
const db_1 = require("../config/db");
class TokenRepository {
    async create(userId, token, expiresAt) {
        return db_1.prisma.refreshToken.create({
            data: {
                userId,
                token,
                expiresAt,
            },
        });
    }
    async findByToken(token) {
        return db_1.prisma.refreshToken.findUnique({
            where: { token },
            include: {
                user: {
                    include: {
                        vendorProfile: true,
                    },
                },
            },
        });
    }
    async deleteByToken(token) {
        await db_1.prisma.refreshToken.deleteMany({
            where: { token },
        });
    }
    async deleteByUserId(userId) {
        await db_1.prisma.refreshToken.deleteMany({
            where: { userId },
        });
    }
}
exports.TokenRepository = TokenRepository;
