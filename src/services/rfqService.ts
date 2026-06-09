import { RFQRepository } from "../repositories/rfqRepository";
import { RFQStatus } from "@prisma/client";
import { NotFoundError, BadRequestError, ForbiddenError } from "../utils/errors";
import { activityLogService } from "./activityLogService";
import { prisma } from "../config/db";

export class RFQService {
  private rfqRepository: RFQRepository;

  constructor(rfqRepository = new RFQRepository()) {
    this.rfqRepository = rfqRepository;
  }

  async createRFQ(
    userId: string,
    data: {
      title: string;
      description: string;
      deadline: string;
      vendorIds: string[];
      documents?: { fileName: string; fileUrl: string }[];
    }
  ) {
    const deadlineDate = new Date(data.deadline);
    if (deadlineDate <= new Date()) {
      throw new BadRequestError("Deadline must be in the future");
    }

    // Auto-generate RFQ Number: RFQ-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const count = await prisma.rFQ.count();
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

    await activityLogService.log(userId, "RFQ_CREATED", { rfqId: rfq?.id, rfqNumber });
    return rfq;
  }

  async getRFQs(_userId: string, role: string, vendorProfileId: string | null) {
    if (role === "VENDOR") {
      if (!vendorProfileId) {
        throw new ForbiddenError("Vendor profile not associated with this user");
      }
      // Vendors only see PUBLISHED/CLOSED/UNDER_REVIEW/COMPLETED RFQs they are assigned to
      return this.rfqRepository.findAll({ vendorId: vendorProfileId });
    }

    // Admins, Procurement Officers, Managers see all RFQs
    return this.rfqRepository.findAll();
  }

  async getRFQById(id: string, _userId: string, role: string, vendorProfileId: string | null) {
    const rfq = await this.rfqRepository.findById(id);
    if (!rfq) {
      throw new NotFoundError("RFQ not found");
    }

    // Vendors can only view the RFQ if they are assigned to it
    if (role === "VENDOR") {
      const isAssigned = rfq.assignedVendors.some(
        (av) => av.vendorId === vendorProfileId
      );
      if (!isAssigned) {
        throw new ForbiddenError("You are not authorized to view this RFQ");
      }
      
      // Hide other vendors' bids/details from this vendor
      return {
        ...rfq,
        assignedVendors: rfq.assignedVendors.filter(
          (av) => av.vendorId === vendorProfileId
        ),
        quotations: rfq.quotations.filter(
          (q) => q.vendorId === vendorProfileId
        ),
      };
    }

    return rfq;
  }

  async assignVendorsToRFQ(userId: string, rfqId: string, vendorIds: string[]) {
    const rfq = await this.rfqRepository.findById(rfqId);
    if (!rfq) {
      throw new NotFoundError("RFQ not found");
    }

    if (rfq.status !== RFQStatus.DRAFT && rfq.status !== RFQStatus.PUBLISHED) {
      throw new BadRequestError("Cannot assign vendors to an RFQ in this status");
    }

    await this.rfqRepository.assignVendors(rfqId, vendorIds);
    await activityLogService.log(userId, "RFQ_VENDORS_ASSIGNED", { rfqId, vendorIds });

    return this.rfqRepository.findById(rfqId);
  }

  async updateRFQStatus(userId: string, rfqId: string, status: RFQStatus) {
    const rfq = await this.rfqRepository.findById(rfqId);
    if (!rfq) {
      throw new NotFoundError("RFQ not found");
    }

    const updated = await this.rfqRepository.update(rfqId, { status });
    await activityLogService.log(userId, "RFQ_STATUS_CHANGED", { rfqId, status });
    return updated;
  }
}

export const rfqService = new RFQService();
