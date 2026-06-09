import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export class QuotationRepository {
  async findById(id: string) {
    return prisma.quotation.findUnique({
      where: { id },
      include: {
        rfq: true,
        vendor: true,
        items: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async create(data: {
    rfqId: string;
    vendorId: string;
    submittedById: string;
    price: number | Prisma.Decimal;
    deliveryTimeline: number;
    remarks?: string;
    pdfUrl?: string;
    items: { description: string; quantity: number; unitPrice: number }[];
  }) {
    return prisma.$transaction(async (tx) => {
      // Create the quotation
      const quotation = await tx.quotation.create({
        data: {
          rfq: { connect: { id: data.rfqId } },
          vendor: { connect: { id: data.vendorId } },
          submittedBy: { connect: { id: data.submittedById } },
          price: data.price,
          deliveryTimeline: data.deliveryTimeline,
          remarks: data.remarks,
          pdfUrl: data.pdfUrl,
        },
      });

      // Create all quotation items
      if (data.items && data.items.length > 0) {
        await tx.quotationItem.createMany({
          data: data.items.map((item) => {
            const total = item.quantity * item.unitPrice;
            return {
              quotationId: quotation.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: total,
            };
          }),
        });
      }

      // Update RFQVendor status to SUBMITTED
      await tx.rFQVendor.updateMany({
        where: {
          rfqId: data.rfqId,
          vendorId: data.vendorId,
        },
        data: {
          status: "SUBMITTED",
        },
      });

      return tx.quotation.findUnique({
        where: { id: quotation.id },
        include: {
          items: true,
          vendor: true,
        },
      });
    });
  }

  async findByRfqId(rfqId: string) {
    return prisma.quotation.findMany({
      where: { rfqId },
      include: {
        vendor: true,
        items: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        price: "asc",
      },
    });
  }

  async findByVendorId(vendorId: string) {
    return prisma.quotation.findMany({
      where: { vendorId },
      include: {
        rfq: true,
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findByRfqAndVendor(rfqId: string, vendorId: string) {
    return prisma.quotation.findFirst({
      where: { rfqId, vendorId },
      include: {
        items: true,
      },
    });
  }
}
export const quotationRepository = new QuotationRepository();
