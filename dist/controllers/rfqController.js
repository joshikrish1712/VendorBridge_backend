"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rfqController = exports.RFQController = void 0;
const rfqService_1 = require("../services/rfqService");
const rfqValidator_1 = require("../validators/rfqValidator");
const response_1 = require("../utils/response");
class RFQController {
    async create(req, res, next) {
        try {
            const validatedData = rfqValidator_1.createRfqSchema.parse(req.body);
            const rfq = await rfqService_1.rfqService.createRFQ(req.user.userId, validatedData);
            return (0, response_1.sendSuccess)(res, rfq, 201);
        }
        catch (error) {
            return next(error);
        }
    }
    async getAll(req, res, next) {
        try {
            const rfqs = await rfqService_1.rfqService.getRFQs(req.user.userId, req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, rfqs);
        }
        catch (error) {
            return next(error);
        }
    }
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const rfq = await rfqService_1.rfqService.getRFQById(id, req.user.userId, req.user.role, req.user.vendorProfileId);
            return (0, response_1.sendSuccess)(res, rfq);
        }
        catch (error) {
            return next(error);
        }
    }
    async assignVendors(req, res, next) {
        try {
            const { id } = req.params;
            const { vendorIds } = rfqValidator_1.assignVendorsSchema.parse(req.body);
            const rfq = await rfqService_1.rfqService.assignVendorsToRFQ(req.user.userId, id, vendorIds);
            return (0, response_1.sendSuccess)(res, rfq);
        }
        catch (error) {
            return next(error);
        }
    }
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = rfqValidator_1.updateRfqStatusSchema.parse(req.body);
            const rfq = await rfqService_1.rfqService.updateRFQStatus(req.user.userId, id, status);
            return (0, response_1.sendSuccess)(res, rfq);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.RFQController = RFQController;
exports.rfqController = new RFQController();
