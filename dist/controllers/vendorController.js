"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorController = exports.VendorController = void 0;
const vendorService_1 = require("../services/vendorService");
const vendorValidator_1 = require("../validators/vendorValidator");
const response_1 = require("../utils/response");
const errors_1 = require("../utils/errors");
class VendorController {
    async getAll(req, res, next) {
        try {
            const status = req.query.status;
            const category = req.query.category;
            const vendors = await vendorService_1.vendorService.getVendors({ status, category });
            return (0, response_1.sendSuccess)(res, vendors);
        }
        catch (error) {
            return next(error);
        }
    }
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            // Authorization check: Vendor can only see their own profile, others can see all
            if (req.user?.role === "VENDOR" && req.user.vendorProfileId !== id) {
                throw new errors_1.ForbiddenError("You are not authorized to view this vendor profile");
            }
            const vendor = await vendorService_1.vendorService.getVendorById(id);
            return (0, response_1.sendSuccess)(res, vendor);
        }
        catch (error) {
            return next(error);
        }
    }
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const validatedData = vendorValidator_1.updateVendorSchema.parse(req.body);
            const updatedVendor = await vendorService_1.vendorService.updateVendorProfile(id, req.user.userId, req.user.role, req.user.vendorProfileId, validatedData);
            return (0, response_1.sendSuccess)(res, updatedVendor);
        }
        catch (error) {
            return next(error);
        }
    }
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = vendorValidator_1.updateVendorStatusSchema.parse(req.body);
            const updatedVendor = await vendorService_1.vendorService.updateVendorStatus(id, status, req.user.userId);
            return (0, response_1.sendSuccess)(res, updatedVendor);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.VendorController = VendorController;
exports.vendorController = new VendorController();
