import { Prisma, RFQStatus } from "@prisma/client";
import { prisma } from "../config/db";

export class RFQRepository {
  async findById(id: string) {
    return prisma.rFQ.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: true,
        assignedVendors: {
          include: {
            vendor: true,
          },
        },
        quotations: {
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
        },
      },
    });
  }

  async create(data: {
    rfqNumber: string;
    title: string;
    description: string;
    deadline: Date;
    createdById: string;
    documents?: { fileName: string; fileUrl: string }[];
    vendorIds: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const rfq = await tx.rFQ.create({
        data: {
          rfqNumber: data.rfqNumber,
          title: data.title,
          description: data.description,
          deadline: data.deadline,
          createdBy: { connect: { id: data.createdById } },
          status: RFQStatus.DRAFT,
          documents: data.documents
            ? {
                createMany: {
                  data: data.documents,
                },
              }
            : undefined,
        },
      });

      if (data.vendorIds && data.vendorIds.length > 0) {
        await tx.rFQVendor.createMany({
          data: data.vendorIds.map((vendorId) => ({
            rfqId: rfq.id,
            vendorId,
            status: "INVITED",
          })),
        });
      }

      return tx.rFQ.findUnique({
        where: { id: rfq.id },
        include: {
          documents: true,
          assignedVendors: { include: { vendor: true } },
        },
      });
    });
  }

  async update(id: string, data: Prisma.RFQUpdateInput) {
    return prisma.rFQ.update({
      where: { id },
      data,
      include: {
        documents: true,
        assignedVendors: { include: { vendor: true } },
      },
    });
  }

  async assignVendors(rfqId: string, vendorIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // Find existing assignments to avoid duplicates
      const existing = await tx.rFQVendor.findMany({
        where: {
          rfqId,
          vendorId: { in: vendorIds },
        },
      });

      const existingIds = existing.map((e) => e.vendorId);
      const newIds = vendorIds.filter((id) => !existingIds.includes(id));

      if (newIds.length > 0) {
        await tx.rFQVendor.createMany({
          data: newIds.map((vendorId) => ({
            rfqId,
            vendorId,
            status: "INVITED",
          })),
        });
      }
    });
  }

  async findAll(filters: { status?: RFQStatus; vendorId?: string } = {}) {
    const whereClause: Prisma.RFQWhereInput = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.vendorId) {
      whereClause.assignedVendors = {
        some: {
          vendorId: filters.vendorId,
        },
      };
      // Vendors should never see DRAFT RFQs - only published and beyond
      if (!filters.status) {
        whereClause.status = {
          in: [RFQStatus.PUBLISHED, RFQStatus.UNDER_REVIEW, RFQStatus.CLOSED, RFQStatus.COMPLETED],
        };
      }
    }

    return prisma.rFQ.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedVendors: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { quotations: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
