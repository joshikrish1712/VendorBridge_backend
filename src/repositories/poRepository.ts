import { Prisma, POStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "../config/db";

export class PORepository {
  async findById(id: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        quotation: {
          include: {
            rfq: true,
            vendor: true,
            items: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        invoice: true,
        approvals: true,
      },
    });
  }

  async create(data: {
    poNumber: string;
    quotationId: string;
    totalAmount: number | Prisma.Decimal;
    termsAndConditions?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // Set quotation status to SELECTED
      await tx.quotation.update({
        where: { id: data.quotationId },
        data: { status: "SELECTED" },
      });

      // Reject all other quotations for the same RFQ
      const quotation = await tx.quotation.findUnique({
        where: { id: data.quotationId },
      });

      if (quotation) {
        await tx.quotation.updateMany({
          where: {
            rfqId: quotation.rfqId,
            id: { not: data.quotationId },
          },
          data: { status: "REJECTED" },
        });

        // Close the RFQ (status UNDER_REVIEW or COMPLETED)
        await tx.rFQ.update({
          where: { id: quotation.rfqId },
          data: { status: "UNDER_REVIEW" },
        });
      }

      return tx.purchaseOrder.create({
        data: {
          poNumber: data.poNumber,
          quotation: { connect: { id: data.quotationId } },
          totalAmount: data.totalAmount,
          termsAndConditions: data.termsAndConditions,
          status: POStatus.PENDING_APPROVAL,
        },
        include: {
          quotation: {
            include: {
              rfq: true,
              vendor: true,
              items: true,
            },
          },
        },
      });
    });
  }

  async update(id: string, data: Prisma.PurchaseOrderUpdateInput) {
    return prisma.purchaseOrder.update({
      where: { id },
      data,
      include: {
        quotation: {
          include: {
            rfq: true,
            vendor: true,
            items: true,
          },
        },
        invoice: true,
        approvals: true,
      },
    });
  }

  async findAll(filters: { status?: POStatus; vendorId?: string } = {}) {
    const whereClause: Prisma.PurchaseOrderWhereInput = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.vendorId) {
      whereClause.quotation = {
        vendorId: filters.vendorId,
      };
    }

    return prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        quotation: {
          include: {
            rfq: {
              select: { rfqNumber: true, title: true },
            },
            vendor: {
              select: { name: true, email: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async createInvoice(data: {
    invoiceNumber: string;
    purchaseOrderId: string;
    amount: number | Prisma.Decimal;
    taxAmount: number | Prisma.Decimal;
    totalAmount: number | Prisma.Decimal;
    dueDate: Date;
  }) {
    return prisma.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        purchaseOrder: { connect: { id: data.purchaseOrderId } },
        amount: data.amount,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        dueDate: data.dueDate,
        status: InvoiceStatus.UNPAID,
      },
      include: {
        purchaseOrder: {
          include: {
            quotation: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });
  }

  async updateInvoice(id: string, data: Prisma.InvoiceUpdateInput) {
    return prisma.invoice.update({
      where: { id },
      data,
      include: {
        purchaseOrder: {
          include: {
            quotation: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });
  }

  async findInvoiceById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            quotation: {
              include: {
                rfq: true,
                vendor: true,
                items: true,
              },
            },
          },
        },
      },
    });
  }

  async findAllInvoices(filters: { status?: InvoiceStatus; vendorId?: string } = {}) {
    const whereClause: Prisma.InvoiceWhereInput = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.vendorId) {
      whereClause.purchaseOrder = {
        quotation: {
          vendorId: filters.vendorId,
        },
      };
    }

    return prisma.invoice.findMany({
      where: whereClause,
      include: {
        purchaseOrder: {
          include: {
            quotation: {
              include: {
                rfq: {
                  select: { title: true },
                },
                vendor: {
                  select: { name: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
export const poRepository = new PORepository();
