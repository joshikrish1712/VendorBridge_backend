import { Response, NextFunction } from "express";
import { quotationService } from "../services/quotationService";
import { createQuotationSchema } from "../validators/quotationValidator";
import { sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../middleware/auth";

export class QuotationController {
  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createQuotationSchema.parse(req.body);
      const quotation = await quotationService.submitQuotation(
        req.user!.userId,
        req.user!.vendorProfileId,
        validatedData
      );
      return sendSuccess(res, quotation, 201);
    } catch (error) {
      return next(error);
    }
  }

  async getByRFQ(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { rfqId } = req.params;
      const quotations = await quotationService.getQuotationsByRFQ(
        rfqId,
        req.user!.role,
        req.user!.vendorProfileId
      );
      return sendSuccess(res, quotations);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const quotation = await quotationService.getQuotationById(
        id,
        req.user!.role,
        req.user!.vendorProfileId
      );
      return sendSuccess(res, quotation);
    } catch (error) {
      return next(error);
    }
  }

  async getVendorQuotations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const quotations = await quotationService.getVendorQuotations(
        req.user!.vendorProfileId
      );
      return sendSuccess(res, quotations);
    } catch (error) {
      return next(error);
    }
  }

  async compare(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { rfqId } = req.params;
      const comparison = await quotationService.compareQuotations(rfqId, req.user!.role);
      return sendSuccess(res, comparison);
    } catch (error) {
      return next(error);
    }
  }
}

export const quotationController = new QuotationController();
