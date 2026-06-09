import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/userRepository";
import { TokenService, TokenPayload } from "./tokenService";
import { prisma } from "../config/db";
import { Role, VendorStatus } from "@prisma/client";
import { BadRequestError, ConflictError, UnauthorizedError, NotFoundError } from "../utils/errors";
import { activityLogService } from "./activityLogService";
import { sendEmail } from "../config/mailer";

export class UserService {
  private userRepository: UserRepository;
  private tokenService: TokenService;

  constructor(userRepository = new UserRepository(), tokenService = new TokenService()) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
  }

  async signup(data: {
    email: string;
    password: string;
    name: string;
    role: Role;
    vendorDetails?: {
      name: string;
      phone: string;
      gstNumber: string;
      address: string;
      categories: string[];
    };
  }) {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(data.password as string, 10);

    // If role is VENDOR, we must create a vendor profile
    if (data.role === Role.VENDOR) {
      if (!data.vendorDetails) {
        throw new BadRequestError("Vendor details are required for Vendor signup");
      }

      // Create vendor profile & user in transaction
      return prisma.$transaction(async (tx) => {
        const existingVendor = await tx.vendor.findUnique({
          where: { email: data.email },
        });
        if (existingVendor) {
          throw new ConflictError("A vendor with this email already exists");
        }

        const vendor = await tx.vendor.create({
          data: {
            name: data.vendorDetails!.name,
            email: data.email,
            phone: data.vendorDetails!.phone,
            gstNumber: data.vendorDetails!.gstNumber,
            address: data.vendorDetails!.address,
            categories: data.vendorDetails!.categories,
            status: VendorStatus.PENDING, // Needs admin approval
          },
        });

        const user = await tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash,
            role: Role.VENDOR,
            vendorProfileId: vendor.id,
          },
          include: {
            vendorProfile: true,
          },
        });

        await activityLogService.log(user.id, "USER_SIGNUP", { role: user.role, vendorId: vendor.id });
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

    await activityLogService.log(user.id, "USER_SIGNUP", { role: user.role });
    return user;
  }

  async login(email: string, password: string, ipAddress?: string) {
    const user = await this.userRepository.findByEmail(email) as any;
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // If vendor, check if vendor status is APPROVED or ACTIVE
    if (user.role === Role.VENDOR && user.vendorProfile) {
      if (
        user.vendorProfile.status === VendorStatus.PENDING ||
        user.vendorProfile.status === VendorStatus.REJECTED
      ) {
        throw new UnauthorizedError(`Vendor profile is not active. Status: ${user.vendorProfile.status}`);
      }
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      vendorProfileId: user.vendorProfileId,
    };

    const token = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);

    await this.tokenService.saveRefreshToken(user.id, refreshToken);
    await activityLogService.log(user.id, "USER_LOGIN", undefined, ipAddress);

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

  async refresh(refreshToken: string) {
    const storedToken = await this.tokenService.verifyRefreshToken(refreshToken) as any;
    const user = storedToken.user;

    const payload: TokenPayload = {
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

  async logout(refreshToken: string, userId?: string) {
    await this.tokenService.revokeRefreshToken(refreshToken);
    if (userId) {
      await activityLogService.log(userId, "USER_LOGOUT");
    }
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // For security, don't reveal that the user doesn't exist
      return;
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save to user
    await this.userRepository.update(user.id, {
      resetOtp: otp,
      resetOtpExpiresAt: expiresAt,
    });

    // Send reset email
    await sendEmail({
      to: user.email,
      subject: "VendorBridge - Password Reset OTP",
      text: `Hello ${user.name},\n\nYou requested a password reset. Your One-Time Password (OTP) is:\n\n${otp}\n\nThis OTP is valid for 10 minutes. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #3B82F6; margin-bottom: 20px;">VendorBridge Password Reset</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>You requested to reset your password. Use the following One-Time Password (OTP) to complete the process:</p>
          <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; color: #111827;">
            ${otp}
          </div>
          <p style="color: #6B7280; font-size: 14px;">This OTP will expire in <strong>10 minutes</strong>. If you did not request this password reset, please ignore this email or contact support.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">VendorBridge Procurement Portal &copy; ${new Date().getFullYear()}</p>
        </div>
      `,
    });

    await activityLogService.log(user.id, "FORGOT_PASSWORD_REQUEST");
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.resetOtp || !user.resetOtpExpiresAt) {
      throw new BadRequestError("No password reset request found for this user");
    }

    if (user.resetOtp !== otp) {
      throw new BadRequestError("Invalid OTP");
    }

    if (new Date() > user.resetOtpExpiresAt) {
      throw new BadRequestError("OTP has expired");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(user.id, {
      passwordHash,
      resetOtp: null,
      resetOtpExpiresAt: null,
    });

    await this.tokenService.revokeUserTokens(user.id); // Log out of all sessions on password reset
    await activityLogService.log(user.id, "PASSWORD_RESET_SUCCESS");
  }

  async updateProfile(userId: string, data: { name?: string; password?: string }) {
    const updateData: any = {};
    if (data.name) {
      updateData.name = data.name;
    }
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    const updatedUser = await this.userRepository.update(userId, updateData);
    await activityLogService.log(userId, "USER_PROFILE_UPDATED", { nameUpdated: !!data.name, passwordUpdated: !!data.password });
    return updatedUser;
  }
}

export const userService = new UserService();
