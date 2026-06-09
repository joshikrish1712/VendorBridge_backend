import { Response, NextFunction } from "express";
import { vendorService } from "../services/vendorService";
import { updateVendorSchema, updateVendorStatusSchema } from "../validators/vendorValidator";
import { sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../middleware/auth";
import { VendorStatus } from "@prisma/client";
import { ForbiddenError } from "../utils/errors";

export class VendorController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as VendorStatus | undefined;
      const category = req.query.category as string | undefined;

      const vendors = await vendorService.getVendors({ status, category });
      return sendSuccess(res, vendors);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Authorization check: Vendor can only see their own profile, others can see all
      if (req.user?.role === "VENDOR" && req.user.vendorProfileId !== id) {
        throw new ForbiddenError("You are not authorized to view this vendor profile");
      }

      const vendor = await vendorService.getVendorById(id);
      return sendSuccess(res, vendor);
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateVendorSchema.parse(req.body);

      const updatedVendor = await vendorService.updateVendorProfile(
        id,
        req.user!.userId,
        req.user!.role,
        req.user!.vendorProfileId,
        validatedData
      );

      return sendSuccess(res, updatedVendor);
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = updateVendorStatusSchema.parse(req.body);

      const updatedVendor = await vendorService.updateVendorStatus(id, status, req.user!.userId);
      return sendSuccess(res, updatedVendor);
    } catch (error) {
      return next(error);
    }
  }
}

export const vendorController = new VendorController();
