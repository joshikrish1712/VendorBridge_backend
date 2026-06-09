"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poRepository = exports.PORepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../config/db");
class PORepository {
    async findById(id) {
        return db_1.prisma.purchaseOrder.findUnique({
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
    async create(data) {
        return db_1.prisma.$transaction(async (tx) => {
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
                    status: client_1.POStatus.PENDING_APPROVAL,
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
    async update(id, data) {
        return db_1.prisma.purchaseOrder.update({
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
    async findAll(filters = {}) {
        const whereClause = {};
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.vendorId) {
            whereClause.quotation = {
                vendorId: filters.vendorId,
            };
        }
        return db_1.prisma.purchaseOrder.findMany({
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
    async createInvoice(data) {
        return db_1.prisma.invoice.create({
            data: {
                invoiceNumber: data.invoiceNumber,
                purchaseOrder: { connect: { id: data.purchaseOrderId } },
                amount: data.amount,
                taxAmount: data.taxAmount,
                totalAmount: data.totalAmount,
                dueDate: data.dueDate,
                status: client_1.InvoiceStatus.UNPAID,
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
    async updateInvoice(id, data) {
        return db_1.prisma.invoice.update({
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
    async findInvoiceById(id) {
        return db_1.prisma.invoice.findUnique({
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
    async findAllInvoices(filters = {}) {
        const whereClause = {};
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
        return db_1.prisma.invoice.findMany({
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
exports.PORepository = PORepository;
exports.poRepository = new PORepository();
