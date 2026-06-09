"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenService = exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tokenRepository_1 = require("../repositories/tokenRepository");
const errors_1 = require("../utils/errors");
class TokenService {
    tokenRepository;
    jwtSecret;
    jwtRefreshSecret;
    constructor(tokenRepository = new tokenRepository_1.TokenRepository()) {
        this.tokenRepository = tokenRepository;
        this.jwtSecret = process.env.JWT_SECRET || "vendorbridge_access_secret";
        this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "vendorbridge_refresh_secret";
    }
    generateAccessToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, { expiresIn: "15m" });
    }
    generateRefreshToken(payload) {
        return jsonwebtoken_1.default.sign({ userId: payload.userId }, this.jwtRefreshSecret, { expiresIn: "7d" });
    }
    async saveRefreshToken(userId, token) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
        await this.tokenRepository.create(userId, token, expiresAt);
    }
    verifyAccessToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.jwtSecret);
        }
        catch (error) {
            throw new errors_1.UnauthorizedError("Invalid or expired access token");
        }
    }
    async verifyRefreshToken(token) {
        try {
            jsonwebtoken_1.default.verify(token, this.jwtRefreshSecret);
            const storedToken = await this.tokenRepository.findByToken(token);
            if (!storedToken || storedToken.expiresAt < new Date()) {
                throw new errors_1.UnauthorizedError("Refresh token is invalid or expired");
            }
            return storedToken;
        }
        catch (error) {
            throw new errors_1.UnauthorizedError("Refresh token validation failed");
        }
    }
    async revokeRefreshToken(token) {
        await this.tokenRepository.deleteByToken(token);
    }
    async revokeUserTokens(userId) {
        await this.tokenRepository.deleteByUserId(userId);
    }
}
exports.TokenService = TokenService;
exports.tokenService = new TokenService();
