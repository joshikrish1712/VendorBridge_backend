"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poController = exports.POController = void 0;
const poService_1 = require("../services/poService");
const poValidator_1 = require("../validators/poValidator");
const response_1 = require("../utils/response");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const errors_1 = require("../utils/errors");
class POController {
    async create(req, res, next) {
        try {
            const validatedData = poValidator_1.createPoSchema.parse(req.body);
            const po = await poService_1.poService.createPO(req.user.userId, validatedData);
            return (0, response_1.sendSuccess)(res, po, 201);
        }
        catch (error) {
            return next(error);
        }
    }
    async getAll(req, res, next) {
        try {
            const pos = await poService_1.poService.getPOs(req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, pos);
        }
        catch (error) {
            return next(error);
        }
    }
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const po = await poService_1.poService.getPOById(id, req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, po);
        }
        catch (error) {
            return next(error);
        }
    }
    async approve(req, res, next) {
        try {
            const { id } = req.params;
            const { action, remarks } = poValidator_1.approvePoSchema.parse(req.body);
            const po = await poService_1.poService.processApproval(req.user.userId, req.user.email, // Using email or name from payload
            id, action, remarks);
            return (0, response_1.sendSuccess)(res, po);
        }
        catch (error) {
            return next(error);
        }
    }
    async getAllInvoices(req, res, next) {
        try {
            const invoices = await poService_1.poService.getInvoices(req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, invoices);
        }
        catch (error) {
            return next(error);
        }
    }
    async getInvoiceById(req, res, next) {
        try {
            const { id } = req.params;
            const invoice = await poService_1.poService.getInvoiceById(id, req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, invoice);
        }
        catch (error) {
            return next(error);
        }
    }
    async downloadPDF(req, res, next) {
        try {
            const { type, number } = req.params; // type = 'po' or 'invoice', number = e.g., 'PO-2026-0001'
            if (type !== "po" && type !== "invoice") {
                throw new errors_1.NotFoundError("Document type not found");
            }
            const filename = `${type}_${number}.pdf`;
            const filePath = path_1.default.join(process.cwd(), "public", "pdfs", filename);
            if (!fs_1.default.existsSync(filePath)) {
                throw new errors_1.NotFoundError("PDF file does not exist or has not been generated");
            }
            return res.sendFile(filePath);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.POController = POController;
exports.poController = new POController();
