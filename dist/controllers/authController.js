"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const userService_1 = require("../services/userService");
const authValidator_1 = require("../validators/authValidator");
const response_1 = require("../utils/response");
const userRepository_1 = require("../repositories/userRepository");
const errors_1 = require("../utils/errors");
const db_1 = require("../config/db");
const userRepository = new userRepository_1.UserRepository();
class AuthController {
    async signup(req, res, next) {
        try {
            const validatedData = authValidator_1.signupSchema.parse(req.body);
            const user = await userService_1.userService.signup(validatedData);
            return (0, response_1.sendSuccess)(res, { id: user.id, email: user.email, name: user.name, role: user.role }, 201);
        }
        catch (error) {
            return next(error);
        }
    }
    async login(req, res, next) {
        try {
            const validatedData = authValidator_1.loginSchema.parse(req.body);
            const ipAddress = req.ip || req.socket.remoteAddress;
            const result = await userService_1.userService.login(validatedData.email, validatedData.password, ipAddress);
            // Set secure cookie for refresh token if in production
            res.cookie("refreshToken", result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            return (0, response_1.sendSuccess)(res, result);
        }
        catch (error) {
            return next(error);
        }
    }
    async refresh(req, res, next) {
        try {
            const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
            if (!refreshToken) {
                return next(new Error("Refresh token is required"));
            }
            const result = await userService_1.userService.refresh(refreshToken);
            res.cookie("refreshToken", result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            return (0, response_1.sendSuccess)(res, result);
        }
        catch (error) {
            return next(error);
        }
    }
    async logout(req, res, next) {
        try {
            const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
            if (refreshToken) {
                await userService_1.userService.logout(refreshToken, req.user?.userId);
            }
            res.clearCookie("refreshToken");
            return (0, response_1.sendSuccess)(res, { message: "Logged out successfully" });
        }
        catch (error) {
            return next(error);
        }
    }
    async forgotPassword(req, res, next) {
        try {
            const { email } = authValidator_1.forgotPasswordSchema.parse(req.body);
            await userService_1.userService.forgotPassword(email);
            return (0, response_1.sendSuccess)(res, { message: "Password reset link has been sent if the email is registered." });
        }
        catch (error) {
            return next(error);
        }
    }
    async resetPassword(req, res, next) {
        try {
            const { token, password } = authValidator_1.resetPasswordSchema.parse(req.body);
            await userService_1.userService.resetPassword(token, password);
            return (0, response_1.sendSuccess)(res, { message: "Password has been reset successfully." });
        }
        catch (error) {
            return next(error);
        }
    }
    async me(req, res, next) {
        try {
            if (!req.user) {
                throw new errors_1.NotFoundError("User not found");
            }
            const user = await userRepository.findById(req.user.userId);
            if (!user || !user.isActive) {
                throw new errors_1.NotFoundError("User not found or suspended");
            }
            return (0, response_1.sendSuccess)(res, {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                vendorProfileId: user.vendorProfileId,
                vendorStatus: user.vendorProfile?.status,
            });
        }
        catch (error) {
            return next(error);
        }
    }
    async updateProfile(req, res, next) {
        try {
            if (!req.user) {
                throw new errors_1.NotFoundError("User not found");
            }
            const { name, password } = req.body;
            const updatedUser = (await userService_1.userService.updateProfile(req.user.userId, { name, password }));
            return (0, response_1.sendSuccess)(res, {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role,
                vendorProfileId: updatedUser.vendorProfileId,
                vendorStatus: updatedUser.vendorProfile?.status,
            });
        }
        catch (error) {
            return next(error);
        }
    }
    async getNotifications(req, res, next) {
        try {
            if (!req.user) {
                throw new errors_1.NotFoundError("User not found");
            }
            const notifications = [];
            const userRole = req.user.role;
            const vendorId = req.user.vendorProfileId;
            // 1. Fetch RFQs
            const rfqs = await db_1.prisma.rFQ.findMany({
                orderBy: { createdAt: "desc" },
                take: 3,
            });
            for (const rfq of rfqs) {
                notifications.push({
                    id: `rfq-${rfq.id}`,
                    title: "New Tender Published",
                    message: `Request for Quotation ${rfq.rfqNumber} ("${rfq.title}") is open for bids.`,
                    type: "rfq",
                    link: `/rfqs/${rfq.id}`,
                    createdAt: rfq.createdAt,
                });
            }
            // 2. Fetch POs
            const pos = await db_1.prisma.purchaseOrder.findMany({
                where: userRole === "VENDOR" ? { quotation: { vendorId: vendorId || "none" } } : {},
                include: {
                    quotation: {
                        include: {
                            vendor: true,
                            rfq: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 3,
            });
            for (const po of pos) {
                if (po.status === "PENDING_APPROVAL") {
                    notifications.push({
                        id: `po-${po.id}`,
                        title: "PO Authorization Pending",
                        message: `Purchase Order ${po.poNumber} ($${Number(po.totalAmount).toLocaleString()}) requires manager signature.`,
                        type: "po",
                        link: `/purchase-orders/${po.id}`,
                        createdAt: po.createdAt,
                    });
                }
                else {
                    notifications.push({
                        id: `po-${po.id}`,
                        title: `PO ${po.status}`,
                        message: `Purchase Order ${po.poNumber} has been transitioned to ${po.status}.`,
                        type: "po",
                        link: `/purchase-orders/${po.id}`,
                        createdAt: po.updatedAt || po.createdAt,
                    });
                }
            }
            // 3. Fetch Invoices
            const invoices = await db_1.prisma.invoice.findMany({
                where: userRole === "VENDOR" ? { purchaseOrder: { quotation: { vendorId: vendorId || "none" } } } : {},
                include: {
                    purchaseOrder: {
                        include: {
                            quotation: {
                                include: {
                                    vendor: true,
                                    rfq: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 3,
            });
            for (const inv of invoices) {
                notifications.push({
                    id: `inv-${inv.id}`,
                    title: `Invoice ${inv.status}`,
                    message: `Billing Invoice ${inv.invoiceNumber} ($${Number(inv.totalAmount).toLocaleString()}) is currently ${inv.status}.`,
                    type: "invoice",
                    link: `/invoices/${inv.id}`,
                    createdAt: inv.createdAt,
                });
            }
            // 4. Fetch Pending Onboarding Profiles (ADMIN only)
            if (userRole === "ADMIN") {
                const pendingVendors = await db_1.prisma.vendor.findMany({
                    where: { status: "PENDING" },
                    take: 3,
                });
                for (const pv of pendingVendors) {
                    notifications.push({
                        id: `vendor-${pv.id}`,
                        title: "Supplier Verification Required",
                        message: `New vendor application for "${pv.name}" requires credentials auditing.`,
                        type: "vendor",
                        link: "/vendor-onboarding",
                        createdAt: pv.createdAt,
                    });
                }
            }
            // Sort notifications by date descending
            notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return (0, response_1.sendSuccess)(res, notifications.slice(0, 10));
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
