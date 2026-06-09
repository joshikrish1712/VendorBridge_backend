"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotationService = exports.QuotationService = void 0;
const quotationRepository_1 = require("../repositories/quotationRepository");
const rfqRepository_1 = require("../repositories/rfqRepository");
const errors_1 = require("../utils/errors");
const activityLogService_1 = require("./activityLogService");
const client_1 = require("@prisma/client");
const rfqRepository = new rfqRepository_1.RFQRepository();
class QuotationService {
    quotationRepository;
    constructor(quotationRepository = new quotationRepository_1.QuotationRepository()) {
        this.quotationRepository = quotationRepository;
    }
    async submitQuotation(userId, vendorProfileId, data) {
        if (!vendorProfileId) {
            throw new errors_1.ForbiddenError("Only users associated with a vendor profile can submit quotations");
        }
        const rfq = await rfqRepository.findById(data.rfqId);
        if (!rfq) {
            throw new errors_1.NotFoundError("RFQ not found");
        }
        // Check if RFQ is open for submissions
        if (rfq.status !== client_1.RFQStatus.PUBLISHED) {
            throw new errors_1.BadRequestError(`Cannot submit quotation. RFQ status is ${rfq.status}`);
        }
        // Check if deadline has passed
        if (new Date() > rfq.deadline) {
            throw new errors_1.BadRequestError("RFQ deadline has passed");
        }
        // Check if vendor was invited/assigned
        const isAssigned = rfq.assignedVendors.some((av) => av.vendorId === vendorProfileId);
        if (!isAssigned) {
            throw new errors_1.ForbiddenError("Your vendor profile is not assigned to this RFQ");
        }
        // Calculate total price from line items
        let totalPrice = 0;
        for (const item of data.items) {
            if (item.quantity <= 0 || item.unitPrice <= 0) {
                throw new errors_1.BadRequestError("Quantity and unit price must be greater than zero");
            }
            totalPrice += item.quantity * item.unitPrice;
        }
        const quotation = await this.quotationRepository.create({
            rfqId: data.rfqId,
            vendorId: vendorProfileId,
            submittedById: userId,
            price: totalPrice,
            deliveryTimeline: data.deliveryTimeline,
            remarks: data.remarks,
            items: data.items,
        });
        await activityLogService_1.activityLogService.log(userId, "QUOTATION_SUBMITTED", {
            rfqId: data.rfqId,
            quotationId: quotation?.id,
            totalPrice,
        });
        return quotation;
    }
    async getQuotationsByRFQ(rfqId, role, _vendorProfileId) {
        // Vendors cannot view all quotations
        if (role === "VENDOR") {
            throw new errors_1.ForbiddenError("Vendors are not authorized to view all RFQ quotations");
        }
        const rfq = await rfqRepository.findById(rfqId);
        if (!rfq) {
            throw new errors_1.NotFoundError("RFQ not found");
        }
        return this.quotationRepository.findByRfqId(rfqId);
    }
    async getQuotationById(id, role, vendorProfileId) {
        const quotation = await this.quotationRepository.findById(id);
        if (!quotation) {
            throw new errors_1.NotFoundError("Quotation not found");
        }
        if (role === "VENDOR" && quotation.vendorId !== vendorProfileId) {
            throw new errors_1.ForbiddenError("You are not authorized to view this quotation");
        }
        return quotation;
    }
    async getVendorQuotations(vendorProfileId) {
        if (!vendorProfileId) {
            throw new errors_1.ForbiddenError("No vendor profile associated with this account");
        }
        return this.quotationRepository.findByVendorId(vendorProfileId);
    }
    async compareQuotations(rfqId, role) {
        if (role === "VENDOR") {
            throw new errors_1.ForbiddenError("Vendors are not authorized to compare quotations");
        }
        const rfq = await rfqRepository.findById(rfqId);
        if (!rfq) {
            throw new errors_1.NotFoundError("RFQ not found");
        }
        const quotations = await this.quotationRepository.findByRfqId(rfqId);
        if (quotations.length === 0) {
            return {
                rfq,
                quotations: [],
                lowestPriceQuotationId: null,
                fastestDeliveryQuotationId: null,
                highestRatedVendorQuotationId: null,
            };
        }
        // Highlight fields
        let lowestPriceId = quotations[0].id;
        let lowestPrice = Number(quotations[0].price);
        let fastestDeliveryId = quotations[0].id;
        let fastestDelivery = quotations[0].deliveryTimeline;
        let highestRatedId = quotations[0].id;
        let highestRating = quotations[0].vendor.rating;
        for (const q of quotations) {
            const price = Number(q.price);
            if (price < lowestPrice) {
                lowestPrice = price;
                lowestPriceId = q.id;
            }
            if (q.deliveryTimeline < fastestDelivery) {
                fastestDelivery = q.deliveryTimeline;
                fastestDeliveryId = q.id;
            }
            if (q.vendor.rating > highestRating) {
                highestRating = q.vendor.rating;
                highestRatedId = q.id;
            }
        }
        return {
            rfq,
            quotations,
            lowestPriceQuotationId: lowestPriceId,
            fastestDeliveryQuotationId: fastestDeliveryId,
            highestRatedVendorQuotationId: highestRatedId,
        };
    }
}
exports.QuotationService = QuotationService;
exports.quotationService = new QuotationService();
