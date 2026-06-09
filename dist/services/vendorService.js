"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorService = exports.VendorService = void 0;
const vendorRepository_1 = require("../repositories/vendorRepository");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const activityLogService_1 = require("./activityLogService");
const db_1 = require("../config/db");
class VendorService {
    vendorRepository;
    constructor(vendorRepository = new vendorRepository_1.VendorRepository()) {
        this.vendorRepository = vendorRepository;
    }
    async getVendors(filters = {}) {
        return this.vendorRepository.findAll(filters);
    }
    async getVendorById(id) {
        const vendor = await this.vendorRepository.findById(id);
        if (!vendor) {
            throw new errors_1.NotFoundError("Vendor not found");
        }
        return vendor;
    }
    async updateVendorProfile(vendorId, currentUserId, currentUserRole, currentUserVendorId, data) {
        // Check authorization: Vendor user must match the vendor ID, or Admin
        if (currentUserRole !== "ADMIN" && currentUserVendorId !== vendorId) {
            throw new errors_1.ForbiddenError("You are not authorized to update this vendor profile");
        }
        const vendor = await this.vendorRepository.findById(vendorId);
        if (!vendor) {
            throw new errors_1.NotFoundError("Vendor not found");
        }
        const updatedVendor = await this.vendorRepository.update(vendorId, data);
        await activityLogService_1.activityLogService.log(currentUserId, "VENDOR_PROFILE_UPDATE", { vendorId });
        return updatedVendor;
    }
    async updateVendorStatus(vendorId, status, adminUserId) {
        const vendor = await this.vendorRepository.findById(vendorId);
        if (!vendor) {
            throw new errors_1.NotFoundError("Vendor not found");
        }
        if (vendor.status === status) {
            throw new errors_1.BadRequestError(`Vendor is already in status: ${status}`);
        }
        // Wrap status change and user activation in transaction
        const updatedVendor = await db_1.prisma.$transaction(async (tx) => {
            const updated = await tx.vendor.update({
                where: { id: vendorId },
                data: { status },
            });
            // If status is ACTIVE or APPROVED, activate all associated users
            // If status is REJECTED or INACTIVE, deactivate them
            const activate = status === client_1.VendorStatus.ACTIVE || status === client_1.VendorStatus.APPROVED;
            await tx.user.updateMany({
                where: { vendorProfileId: vendorId },
                data: { isActive: activate },
            });
            return updated;
        });
        await activityLogService_1.activityLogService.log(adminUserId, "VENDOR_STATUS_CHANGE", { vendorId, from: vendor.status, to: status });
        return updatedVendor;
    }
}
exports.VendorService = VendorService;
exports.vendorService = new VendorService();
