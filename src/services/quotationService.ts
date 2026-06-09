import { QuotationRepository } from "../repositories/quotationRepository";
import { RFQRepository } from "../repositories/rfqRepository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../utils/errors";
import { activityLogService } from "./activityLogService";
import { RFQStatus } from "@prisma/client";

const rfqRepository = new RFQRepository();

export class QuotationService {
  private quotationRepository: QuotationRepository;

  constructor(quotationRepository = new QuotationRepository()) {
    this.quotationRepository = quotationRepository;
  }

  async submitQuotation(
    userId: string,
    vendorProfileId: string | null,
    data: {
      rfqId: string;
      deliveryTimeline: number;
      remarks?: string;
      items: { description: string; quantity: number; unitPrice: number }[];
    }
  ) {
    if (!vendorProfileId) {
      throw new ForbiddenError("Only users associated with a vendor profile can submit quotations");
    }

    const rfq = await rfqRepository.findById(data.rfqId);
    if (!rfq) {
      throw new NotFoundError("RFQ not found");
    }

    // Check if RFQ is open for submissions
    if (rfq.status !== RFQStatus.PUBLISHED) {
      throw new BadRequestError(`Cannot submit quotation. RFQ status is ${rfq.status}`);
    }

    // Check if deadline has passed
    if (new Date() > rfq.deadline) {
      throw new BadRequestError("RFQ deadline has passed");
    }

    // Check if vendor was invited/assigned
    const isAssigned = rfq.assignedVendors.some((av) => av.vendorId === vendorProfileId);
    if (!isAssigned) {
      throw new ForbiddenError("Your vendor profile is not assigned to this RFQ");
    }

    // Check if vendor has already submitted a quotation for this RFQ
    const existingQuotation = await this.quotationRepository.findByRfqAndVendor(data.rfqId, vendorProfileId);
    if (existingQuotation) {
      throw new BadRequestError("You have already submitted a quotation for this RFQ");
    }

    // Calculate total price from line items
    let totalPrice = 0;
    for (const item of data.items) {
      if (item.quantity <= 0 || item.unitPrice <= 0) {
        throw new BadRequestError("Quantity and unit price must be greater than zero");
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

    await activityLogService.log(userId, "QUOTATION_SUBMITTED", {
      rfqId: data.rfqId,
      quotationId: quotation?.id,
      totalPrice,
    });

    return quotation;
  }

  async getQuotationsByRFQ(rfqId: string, role: string, _vendorProfileId: string | null) {
    // Vendors cannot view all quotations
    if (role === "VENDOR") {
      throw new ForbiddenError("Vendors are not authorized to view all RFQ quotations");
    }

    const rfq = await rfqRepository.findById(rfqId);
    if (!rfq) {
      throw new NotFoundError("RFQ not found");
    }

    return this.quotationRepository.findByRfqId(rfqId);
  }

  async getQuotationById(id: string, role: string, vendorProfileId: string | null) {
    const quotation = await this.quotationRepository.findById(id);
    if (!quotation) {
      throw new NotFoundError("Quotation not found");
    }

    if (role === "VENDOR" && quotation.vendorId !== vendorProfileId) {
      throw new ForbiddenError("You are not authorized to view this quotation");
    }

    return quotation;
  }

  async getVendorQuotations(vendorProfileId: string | null) {
    if (!vendorProfileId) {
      throw new ForbiddenError("No vendor profile associated with this account");
    }
    return this.quotationRepository.findByVendorId(vendorProfileId);
  }

  async compareQuotations(rfqId: string, role: string) {
    if (role === "VENDOR") {
      throw new ForbiddenError("Vendors are not authorized to compare quotations");
    }

    const rfq = await rfqRepository.findById(rfqId);
    if (!rfq) {
      throw new NotFoundError("RFQ not found");
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

export const quotationService = new QuotationService();
