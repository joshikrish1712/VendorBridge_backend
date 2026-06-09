import { Response, NextFunction } from "express";
import { poService } from "../services/poService";
import { createPoSchema, approvePoSchema } from "../validators/poValidator";
import { sendSuccess } from "../utils/response";
import { AuthenticatedRequest } from "../middleware/auth";
import fs from "fs";
import path from "path";
import { NotFoundError } from "../utils/errors";

export class POController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createPoSchema.parse(req.body);
      const po = await poService.createPO(req.user!.userId, validatedData);
      return sendSuccess(res, po, 201);
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pos = await poService.getPOs(req.user!.role, req.user!.vendorProfileId);
      return sendSuccess(res, pos);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const po = await poService.getPOById(id, req.user!.role, req.user!.vendorProfileId);
      return sendSuccess(res, po);
    } catch (error) {
      return next(error);
    }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { action, remarks } = approvePoSchema.parse(req.body);
      
      const po = await poService.processApproval(
        req.user!.userId,
        req.user!.email, // Using email or name from payload
        id,
        action,
        remarks
      );
      return sendSuccess(res, po);
    } catch (error) {
      return next(error);
    }
  }

  async getAllInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invoices = await poService.getInvoices(req.user!.role, req.user!.vendorProfileId);
      return sendSuccess(res, invoices);
    } catch (error) {
      return next(error);
    }
  }

  async getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const invoice = await poService.getInvoiceById(id, req.user!.role, req.user!.vendorProfileId);
      return sendSuccess(res, invoice);
    } catch (error) {
      return next(error);
    }
  }

  async downloadPDF(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { type, number } = req.params; // type = 'po' or 'invoice', number = e.g., 'PO-2026-0001'
      
      if (type !== "po" && type !== "invoice") {
        throw new NotFoundError("Document type not found");
      }

      const filename = `${type}_${number}.pdf`;
      const filePath = path.join(process.cwd(), "public", "pdfs", filename);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundError("PDF file does not exist or has not been generated");
      }

      return res.sendFile(filePath);
    } catch (error) {
      return next(error);
    }
  }
}

export const poController = new POController();
