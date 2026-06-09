import { VendorRepository } from "../repositories/vendorRepository";
import { VendorStatus } from "@prisma/client";
import { NotFoundError, ForbiddenError, BadRequestError } from "../utils/errors";
import { activityLogService } from "./activityLogService";
import { prisma } from "../config/db";

export class VendorService {
  private vendorRepository: VendorRepository;

  constructor(vendorRepository = new VendorRepository()) {
    this.vendorRepository = vendorRepository;
  }

  async getVendors(filters: { status?: VendorStatus; category?: string } = {}) {
    return this.vendorRepository.findAll(filters);
  }

  async getVendorById(id: string) {
    const vendor = await this.vendorRepository.findById(id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  }

  async updateVendorProfile(
    vendorId: string,
    currentUserId: string,
    currentUserRole: string,
    currentUserVendorId: string | null,
    data: {
      name?: string;
      phone?: string;
      address?: string;
      categories?: string[];
      gstNumber?: string;
    }
  ) {
    // Check authorization: Vendor user must match the vendor ID, or Admin
    if (currentUserRole !== "ADMIN" && currentUserVendorId !== vendorId) {
      throw new ForbiddenError("You are not authorized to update this vendor profile");
    }

    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }

    const updatedVendor = await this.vendorRepository.update(vendorId, data);
    await activityLogService.log(currentUserId, "VENDOR_PROFILE_UPDATE", { vendorId });
    return updatedVendor;
  }

  async updateVendorStatus(
    vendorId: string,
    status: VendorStatus,
    adminUserId: string
  ) {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }

    if (vendor.status === status) {
      throw new BadRequestError(`Vendor is already in status: ${status}`);
    }

    // Wrap status change and user activation in transaction
    const updatedVendor = await prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.update({
        where: { id: vendorId },
        data: { status },
      });

      // If status is ACTIVE or APPROVED, activate all associated users
      // If status is REJECTED or INACTIVE, deactivate them
      const activate = status === VendorStatus.ACTIVE || status === VendorStatus.APPROVED;
      await tx.user.updateMany({
        where: { vendorProfileId: vendorId },
        data: { isActive: activate },
      });

      return updated;
    });

    await activityLogService.log(adminUserId, "VENDOR_STATUS_CHANGE", { vendorId, from: vendor.status, to: status });
    return updatedVendor;
  }
}

export const vendorService = new VendorService();
