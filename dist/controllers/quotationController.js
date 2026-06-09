"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotationController = exports.QuotationController = void 0;
const quotationService_1 = require("../services/quotationService");
const quotationValidator_1 = require("../validators/quotationValidator");
const response_1 = require("../utils/response");
class QuotationController {
    async submit(req, res, next) {
        try {
            const validatedData = quotationValidator_1.createQuotationSchema.parse(req.body);
            const quotation = await quotationService_1.quotationService.submitQuotation(req.user.userId, req.user.vendorProfileId, validatedData);
            return (0, response_1.sendSuccess)(res, quotation, 201);
        }
        catch (error) {
            return next(error);
        }
    }
    async getByRFQ(req, res, next) {
        try {
            const { rfqId } = req.params;
            const quotations = await quotationService_1.quotationService.getQuotationsByRFQ(rfqId, req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, quotations);
        }
        catch (error) {
            return next(error);
        }
    }
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const quotation = await quotationService_1.quotationService.getQuotationById(id, req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, quotation);
        }
        catch (error) {
            return next(error);
        }
    }
    async getVendorQuotations(req, res, next) {
        try {
            const quotations = await quotationService_1.quotationService.getVendorQuotations(req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, quotations);
        }
        catch (error) {
            return next(error);
        }
    }
    async compare(req, res, next) {
        try {
            const { rfqId } = req.params;
            const comparison = await quotationService_1.quotationService.compareQuotations(rfqId, req.user.role);
            return (0, response_1.sendSuccess)(res, comparison);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.QuotationController = QuotationController;
exports.quotationController = new QuotationController();
