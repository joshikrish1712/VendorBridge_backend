"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const userRepository_1 = require("../repositories/userRepository");
const tokenService_1 = require("./tokenService");
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const activityLogService_1 = require("./activityLogService");
const mailer_1 = require("../config/mailer");
class UserService {
    userRepository;
    tokenService;
    constructor(userRepository = new userRepository_1.UserRepository(), tokenService = new tokenService_1.TokenService()) {
        this.userRepository = userRepository;
        this.tokenService = tokenService;
    }
    async signup(data) {
        const existingUser = await this.userRepository.findByEmail(data.email);
        if (existingUser) {
            throw new errors_1.ConflictError("Email already registered");
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
        // If role is VENDOR, we must create a vendor profile
        if (data.role === client_1.Role.VENDOR) {
            if (!data.vendorDetails) {
                throw new errors_1.BadRequestError("Vendor details are required for Vendor signup");
            }
            // Create vendor profile & user in transaction
            return db_1.prisma.$transaction(async (tx) => {
                const existingVendor = await tx.vendor.findUnique({
                    where: { email: data.email },
                });
                if (existingVendor) {
                    throw new errors_1.ConflictError("A vendor with this email already exists");
                }
                const vendor = await tx.vendor.create({
                    data: {
                        name: data.vendorDetails.name,
                        email: data.email,
                        phone: data.vendorDetails.phone,
                        gstNumber: data.vendorDetails.gstNumber,
                        address: data.vendorDetails.address,
                        categories: data.vendorDetails.categories,
                        status: client_1.VendorStatus.PENDING, // Needs admin approval
                    },
                });
                const user = await tx.user.create({
                    data: {
                        email: data.email,
                        name: data.name,
                        passwordHash,
                        role: client_1.Role.VENDOR,
                        vendorProfileId: vendor.id,
                    },
                    include: {
                        vendorProfile: true,
                    },
                });
                await activityLogService_1.activityLogService.log(user.id, "USER_SIGNUP", { role: user.role, vendorId: vendor.id });
                return user;
            });
        }
        // For other roles (Admin, Procurement Officer, Manager)
        const user = await this.userRepository.create({
            email: data.email,
            name: data.name,
            passwordHash,
            role: data.role,
        });
        await activityLogService_1.activityLogService.log(user.id, "USER_SIGNUP", { role: user.role });
        return user;
    }
    async login(email, password, ipAddress) {
        const user = await this.userRepository.findByEmail(email);
        if (!user || !user.isActive) {
            throw new errors_1.UnauthorizedError("Invalid email or password");
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new errors_1.UnauthorizedError("Invalid email or password");
        }
        // If vendor, check if vendor status is APPROVED or ACTIVE
        if (user.role === client_1.Role.VENDOR && user.vendorProfile) {
            if (user.vendorProfile.status === client_1.VendorStatus.PENDING ||
                user.vendorProfile.status === client_1.VendorStatus.REJECTED) {
                throw new errors_1.UnauthorizedError(`Vendor profile is not active. Status: ${user.vendorProfile.status}`);
            }
        }
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            vendorProfileId: user.vendorProfileId,
        };
        const token = this.tokenService.generateAccessToken(payload);
        const refreshToken = this.tokenService.generateRefreshToken(payload);
        await this.tokenService.saveRefreshToken(user.id, refreshToken);
        await activityLogService_1.activityLogService.log(user.id, "USER_LOGIN", undefined, ipAddress);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                vendorProfileId: user.vendorProfileId,
                vendorStatus: user.vendorProfile?.status,
            },
            token,
            refreshToken,
        };
    }
    async refresh(refreshToken) {
        const storedToken = await this.tokenService.verifyRefreshToken(refreshToken);
        const user = storedToken.user;
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            vendorProfileId: user.vendorProfileId,
        };
        const newToken = this.tokenService.generateAccessToken(payload);
        const newRefreshToken = this.tokenService.generateRefreshToken(payload);
        // Rotate refresh token
        await this.tokenService.revokeRefreshToken(refreshToken);
        await this.tokenService.saveRefreshToken(user.id, newRefreshToken);
        return {
            token: newToken,
            refreshToken: newRefreshToken,
        };
    }
    async logout(refreshToken, userId) {
        await this.tokenService.revokeRefreshToken(refreshToken);
        if (userId) {
            await activityLogService_1.activityLogService.log(userId, "USER_LOGOUT");
        }
    }
    async forgotPassword(email) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            // For security, don't reveal that the user doesn't exist
            return;
        }
        // Generate a simple token or mock link
        const resetToken = this.tokenService.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            vendorProfileId: user.vendorProfileId,
        });
        const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
        // Send reset email
        await (0, mailer_1.sendEmail)({
            to: user.email,
            subject: "VendorBridge - Password Reset Request",
            text: `Hello ${user.name},\n\nYou requested a password reset. Please click on the following link to reset your password:\n\n${resetLink}\n\nThis link will expire in 15 minutes.`,
            html: `<p>Hello ${user.name},</p><p>You requested a password reset. Please click on the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link will expire in 15 minutes.</p>`,
        });
        await activityLogService_1.activityLogService.log(user.id, "FORGOT_PASSWORD_REQUEST");
    }
    async resetPassword(token, newPassword) {
        const payload = this.tokenService.verifyAccessToken(token);
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await this.userRepository.update(payload.userId, { passwordHash });
        await this.tokenService.revokeUserTokens(payload.userId); // Log out of all sessions on password reset
        await activityLogService_1.activityLogService.log(payload.userId, "PASSWORD_RESET_SUCCESS");
    }
    async updateProfile(userId, data) {
        const updateData = {};
        if (data.name) {
            updateData.name = data.name;
        }
        if (data.password) {
            updateData.passwordHash = await bcryptjs_1.default.hash(data.password, 10);
        }
        const updatedUser = await this.userRepository.update(userId, updateData);
        await activityLogService_1.activityLogService.log(userId, "USER_PROFILE_UPDATED", { nameUpdated: !!data.name, passwordUpdated: !!data.password });
        return updatedUser;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
