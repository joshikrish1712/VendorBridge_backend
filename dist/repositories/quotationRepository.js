"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotationRepository = exports.QuotationRepository = void 0;
const db_1 = require("../config/db");
class QuotationRepository {
    async findById(id) {
        return db_1.prisma.quotation.findUnique({
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
    async create(data) {
        return db_1.prisma.$transaction(async (tx) => {
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
    async findByRfqId(rfqId) {
        return db_1.prisma.quotation.findMany({
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
    async findByVendorId(vendorId) {
        return db_1.prisma.quotation.findMany({
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
}
exports.QuotationRepository = QuotationRepository;
exports.quotationRepository = new QuotationRepository();
