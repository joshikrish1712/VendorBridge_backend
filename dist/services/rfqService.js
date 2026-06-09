"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rfqService = exports.RFQService = void 0;
const rfqRepository_1 = require("../repositories/rfqRepository");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const activityLogService_1 = require("./activityLogService");
const db_1 = require("../config/db");
class RFQService {
    rfqRepository;
    constructor(rfqRepository = new rfqRepository_1.RFQRepository()) {
        this.rfqRepository = rfqRepository;
    }
    async createRFQ(userId, data) {
        const deadlineDate = new Date(data.deadline);
        if (deadlineDate <= new Date()) {
            throw new errors_1.BadRequestError("Deadline must be in the future");
        }
        // Auto-generate RFQ Number: RFQ-YYYY-XXXX
        const currentYear = new Date().getFullYear();
        const count = await db_1.prisma.rFQ.count();
        const rfqNumber = `RFQ-${currentYear}-${String(count + 1).padStart(4, "0")}`;
        const rfq = await this.rfqRepository.create({
            rfqNumber,
            title: data.title,
            description: data.description,
            deadline: deadlineDate,
            createdById: userId,
            documents: data.documents,
            vendorIds: data.vendorIds,
        });
        await activityLogService_1.activityLogService.log(userId, "RFQ_CREATED", { rfqId: rfq?.id, rfqNumber });
        return rfq;
    }
    async getRFQs(_userId, role, vendorProfileId) {
        if (role === "VENDOR") {
            if (!vendorProfileId) {
                throw new errors_1.ForbiddenError("Vendor profile not associated with this user");
            }
            // Vendors only see PUBLISHED/CLOSED/UNDER_REVIEW/COMPLETED RFQs they are assigned to
            return this.rfqRepository.findAll({ vendorId: vendorProfileId });
        }
        // Admins, Procurement Officers, Managers see all RFQs
        return this.rfqRepository.findAll();
    }
    async getRFQById(id, _userId, role, vendorProfileId) {
        const rfq = await this.rfqRepository.findById(id);
        if (!rfq) {
            throw new errors_1.NotFoundError("RFQ not found");
        }
        // Vendors can only view the RFQ if they are assigned to it
        if (role === "VENDOR") {
            const isAssigned = rfq.assignedVendors.some((av) => av.vendorId === vendorProfileId);
            if (!isAssigned) {
                throw new errors_1.ForbiddenError("You are not authorized to view this RFQ");
            }
            // Hide other vendors' bids/details from this vendor
            return {
                ...rfq,
                assignedVendors: rfq.assignedVendors.filter((av) => av.vendorId === vendorProfileId),
                quotations: rfq.quotations.filter((q) => q.vendorId === vendorProfileId),
            };
        }
        return rfq;
    }
    async assignVendorsToRFQ(userId, rfqId, vendorIds) {
        const rfq = await this.rfqRepository.findById(rfqId);
        if (!rfq) {
            throw new errors_1.NotFoundError("RFQ not found");
        }
        if (rfq.status !== client_1.RFQStatus.DRAFT && rfq.status !== client_1.RFQStatus.PUBLISHED) {
            throw new errors_1.BadRequestError("Cannot assign vendors to an RFQ in this status");
        }
        await this.rfqRepository.assignVendors(rfqId, vendorIds);
        await activityLogService_1.activityLogService.log(userId, "RFQ_VENDORS_ASSIGNED", { rfqId, vendorIds });
        return this.rfqRepository.findById(rfqId);
    }
    async updateRFQStatus(userId, rfqId, status) {
        const rfq = await this.rfqRepository.findById(rfqId);
        if (!rfq) {
            throw new errors_1.NotFoundError("RFQ not found");
        }
        const updated = await this.rfqRepository.update(rfqId, { status });
        await activityLogService_1.activityLogService.log(userId, "RFQ_STATUS_CHANGED", { rfqId, status });
        return updated;
    }
}
exports.RFQService = RFQService;
exports.rfqService = new RFQService();
