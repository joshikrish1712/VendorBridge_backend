import { Response, NextFunction } from "express";
import { rfqService } from "../services/rfqService";
import { createRfqSchema, assignVendorsSchema, updateRfqStatusSchema } from "../validators/rfqValidator";
import { sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../middleware/auth";

export class RFQController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createRfqSchema.parse(req.body);
      const rfq = await rfqService.createRFQ(req.user!.userId, validatedData);
      return sendSuccess(res, rfq, 201);
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rfqs = await rfqService.getRFQs(
        req.user!.userId,
        req.user!.role,
        req.user!.vendorProfileId
      );
      return sendSuccess(res, rfqs);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const rfq = await rfqService.getRFQById(
        id,
        req.user!.userId,
        req.user!.role,
        req.user!.vendorProfileId
      );
      return sendSuccess(res, rfq);
    } catch (error) {
      return next(error);
    }
  }

  async assignVendors(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { vendorIds } = assignVendorsSchema.parse(req.body);
      const rfq = await rfqService.assignVendorsToRFQ(req.user!.userId, id, vendorIds);
      return sendSuccess(res, rfq);
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = updateRfqStatusSchema.parse(req.body);
      const rfq = await rfqService.updateRFQStatus(req.user!.userId, id, status);
      return sendSuccess(res, rfq);
    } catch (error) {
      return next(error);
    }
  }
}

export const rfqController = new RFQController();
