"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RFQRepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../config/db");
class RFQRepository {
    async findById(id) {
        return db_1.prisma.rFQ.findUnique({
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
    async create(data) {
        return db_1.prisma.$transaction(async (tx) => {
            const rfq = await tx.rFQ.create({
                data: {
                    rfqNumber: data.rfqNumber,
                    title: data.title,
                    description: data.description,
                    deadline: data.deadline,
                    createdBy: { connect: { id: data.createdById } },
                    status: client_1.RFQStatus.DRAFT,
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
    async update(id, data) {
        return db_1.prisma.rFQ.update({
            where: { id },
            data,
            include: {
                documents: true,
                assignedVendors: { include: { vendor: true } },
            },
        });
    }
    async assignVendors(rfqId, vendorIds) {
        return db_1.prisma.$transaction(async (tx) => {
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
    async findAll(filters = {}) {
        const whereClause = {};
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.vendorId) {
            whereClause.assignedVendors = {
                some: {
                    vendorId: filters.vendorId,
                },
            };
        }
        return db_1.prisma.rFQ.findMany({
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
exports.RFQRepository = RFQRepository;
