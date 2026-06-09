import { Response, NextFunction } from "express";
import { userService } from "../services/userService";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/authValidator";
import { sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../middleware/auth";
import { UserRepository } from "../repositories/userRepository";
import { NotFoundError } from "../utils/errors";
import { prisma } from "../config/db";

const userRepository = new UserRepository();

export class AuthController {
  async signup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = signupSchema.parse(req.body);
      const user = await userService.signup(validatedData);
      return sendSuccess(res, { id: user.id, email: user.email, name: user.name, role: user.role }, 201);
    } catch (error) {
      return next(error);
    }
  }

  async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await userService.login(validatedData.email, validatedData.password, ipAddress);
      
      // Set secure cookie for refresh token if in production
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  }

  async refresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      if (!refreshToken) {
        return next(new Error("Refresh token is required"));
      }
      const result = await userService.refresh(refreshToken);
      
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      if (refreshToken) {
        await userService.logout(refreshToken, req.user?.userId);
      }
      res.clearCookie("refreshToken");
      return sendSuccess(res, { message: "Logged out successfully" });
    } catch (error) {
      return next(error);
    }
  }

  async forgotPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await userService.forgotPassword(email);
      return sendSuccess(res, { message: "A 6-digit OTP has been sent to your email if it is registered." });
    } catch (error) {
      return next(error);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, otp, password } = resetPasswordSchema.parse(req.body);
      await userService.resetPassword(email, otp, password);
      return sendSuccess(res, { message: "Password has been reset successfully." });
    } catch (error) {
      return next(error);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new NotFoundError("User not found");
      }
      const user = await userRepository.findById(req.user.userId) as any;
      if (!user || !user.isActive) {
        throw new NotFoundError("User not found or suspended");
      }
      return sendSuccess(res, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        vendorProfileId: user.vendorProfileId,
        vendorStatus: user.vendorProfile?.status,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new NotFoundError("User not found");
      }
      const { name, password } = req.body;
      const updatedUser = (await userService.updateProfile(req.user.userId, { name, password })) as any;
      return sendSuccess(res, {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        vendorProfileId: updatedUser.vendorProfileId,
        vendorStatus: updatedUser.vendorProfile?.status,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new NotFoundError("User not found");
      }
      
      const notifications = [];
      const userRole = req.user.role;
      const vendorId = req.user.vendorProfileId;

      // 1. Fetch RFQs
      const rfqs = await prisma.rFQ.findMany({
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
      const pos = await prisma.purchaseOrder.findMany({
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
        } else {
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
      const invoices = await prisma.invoice.findMany({
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
        const pendingVendors = await prisma.vendor.findMany({
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

      return sendSuccess(res, notifications.slice(0, 10));
    } catch (error) {
      return next(error);
    }
  }
}

export const authController = new AuthController();

