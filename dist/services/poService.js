"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poService = exports.POService = void 0;
const poRepository_1 = require("../repositories/poRepository");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const activityLogService_1 = require("./activityLogService");
const pdfGenerator_1 = require("../utils/pdfGenerator");
const mailer_1 = require("../config/mailer");
const db_1 = require("../config/db");
const path_1 = __importDefault(require("path"));
class POService {
    async createPO(userId, data) {
        const quotation = await db_1.prisma.quotation.findUnique({
            where: { id: data.quotationId },
            include: { rfq: true, vendor: true },
        });
        if (!quotation) {
            throw new errors_1.NotFoundError("Quotation not found");
        }
        if (quotation.rfq.status !== client_1.RFQStatus.PUBLISHED && quotation.rfq.status !== client_1.RFQStatus.UNDER_REVIEW) {
            throw new errors_1.BadRequestError("RFQ is not in a valid status for selection");
        }
        // Auto-generate PO Number: PO-YYYY-XXXX
        const currentYear = new Date().getFullYear();
        const count = await db_1.prisma.purchaseOrder.count();
        const poNumber = `PO-${currentYear}-${String(count + 1).padStart(4, "0")}`;
        const po = await poRepository_1.poRepository.create({
            poNumber,
            quotationId: data.quotationId,
            totalAmount: quotation.price,
            termsAndConditions: data.termsAndConditions,
        });
        await activityLogService_1.activityLogService.log(userId, "PO_DRAFT_CREATED", {
            poId: po.id,
            poNumber,
            quotationId: data.quotationId,
        });
        return po;
    }
    async getPOs(role, vendorProfileId) {
        if (role === "VENDOR") {
            return poRepository_1.poRepository.findAll({ vendorId: vendorProfileId || undefined });
        }
        return poRepository_1.poRepository.findAll();
    }
    async getPOById(id, role, vendorProfileId) {
        const po = await poRepository_1.poRepository.findById(id);
        if (!po) {
            throw new errors_1.NotFoundError("Purchase Order not found");
        }
        if (role === "VENDOR" && po.quotation.vendorId !== vendorProfileId) {
            throw new errors_1.ForbiddenError("You are not authorized to view this Purchase Order");
        }
        return po;
    }
    async processApproval(userId, userName, poId, action, remarks) {
        const po = await poRepository_1.poRepository.findById(poId);
        if (!po) {
            throw new errors_1.NotFoundError("Purchase Order not found");
        }
        if (po.status !== client_1.POStatus.PENDING_APPROVAL) {
            throw new errors_1.BadRequestError(`Purchase Order is not pending approval. Status: ${po.status}`);
        }
        const nextStatus = action === "APPROVED" ? client_1.POStatus.APPROVED : client_1.POStatus.REJECTED;
        return db_1.prisma.$transaction(async (tx) => {
            // 1. Create approval history record
            await tx.approvalHistory.create({
                data: {
                    purchaseOrderId: poId,
                    userId,
                    userName,
                    action,
                    remarks,
                },
            });
            // 2. Update PO status
            const updatedPo = await tx.purchaseOrder.update({
                where: { id: poId },
                data: {
                    status: nextStatus,
                    approvedById: userId,
                    approvedAt: new Date(),
                    remarks,
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
            // 3. If approved, generate PDFs, invoice, send email, complete RFQ
            if (nextStatus === client_1.POStatus.APPROVED) {
                // Update RFQ status to COMPLETED
                await tx.rFQ.update({
                    where: { id: updatedPo.quotation.rfqId },
                    data: { status: client_1.RFQStatus.COMPLETED },
                });
                // Create Invoice: INV-YYYY-XXXX
                const currentYear = new Date().getFullYear();
                const invoiceCount = await tx.invoice.count();
                const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, "0")}`;
                const baseAmount = Number(updatedPo.totalAmount);
                const taxAmount = baseAmount * 0.18; // 18% GST
                const totalAmount = baseAmount + taxAmount;
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30); // 30 days due
                const invoice = await tx.invoice.create({
                    data: {
                        invoiceNumber,
                        purchaseOrderId: poId,
                        amount: baseAmount,
                        taxAmount,
                        totalAmount,
                        dueDate,
                        status: client_1.InvoiceStatus.UNPAID,
                    },
                });
                // Trigger Async PDF generation and email delivery (will resolve after transaction commits, but we can generate paths now)
                // We will run this outside or inside but we shouldn't block the transaction too long.
                // Let's execute the email trigger right after transaction finishes
                return { po: updatedPo, invoice, triggerEmail: true };
            }
            // If rejected, set RFQ back to PUBLISHED so other quotations can be selected
            if (nextStatus === client_1.POStatus.REJECTED) {
                await tx.rFQ.update({
                    where: { id: updatedPo.quotation.rfqId },
                    data: { status: client_1.RFQStatus.PUBLISHED },
                });
                await tx.quotation.update({
                    where: { id: updatedPo.quotationId },
                    data: { status: "SUBMITTED" }, // reset status
                });
            }
            return { po: updatedPo, invoice: null, triggerEmail: false };
        }).then(async (result) => {
            await activityLogService_1.activityLogService.log(userId, `PO_${action}`, { poId, remarks });
            if (result.triggerEmail && result.invoice) {
                // Run generation of PDFs and send email
                try {
                    const poData = result.po;
                    const vendor = poData.quotation.vendor;
                    // 1. Generate PO PDF
                    const poPdfPath = await (0, pdfGenerator_1.generateDocumentPDF)({
                        title: "Purchase Order",
                        number: poData.poNumber,
                        date: new Date(poData.createdAt).toLocaleDateString(),
                        vendorName: vendor.name,
                        vendorEmail: vendor.email,
                        vendorPhone: vendor.phone,
                        vendorAddress: vendor.address,
                        vendorGST: vendor.gstNumber,
                        items: poData.quotation.items.map((item) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: Number(item.unitPrice),
                            totalPrice: Number(item.totalPrice),
                        })),
                        subtotal: Number(poData.totalAmount),
                        total: Number(poData.totalAmount),
                        terms: poData.termsAndConditions || "Net 30. Please deliver within timeline.",
                    }, "po");
                    // 2. Generate Invoice PDF
                    const invPdfPath = await (0, pdfGenerator_1.generateDocumentPDF)({
                        title: "Invoice / Bill",
                        number: result.invoice.invoiceNumber,
                        date: new Date(result.invoice.createdAt).toLocaleDateString(),
                        vendorName: vendor.name,
                        vendorEmail: vendor.email,
                        vendorPhone: vendor.phone,
                        vendorAddress: vendor.address,
                        vendorGST: vendor.gstNumber,
                        items: poData.quotation.items.map((item) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: Number(item.unitPrice),
                            totalPrice: Number(item.totalPrice),
                        })),
                        subtotal: Number(result.invoice.amount),
                        tax: Number(result.invoice.taxAmount),
                        total: Number(result.invoice.totalAmount),
                        terms: `Due Date: ${new Date(result.invoice.dueDate).toLocaleDateString()}. Please wire to vendor account.`,
                    }, "invoice");
                    // Update PDF URLs in database
                    await db_1.prisma.purchaseOrder.update({
                        where: { id: poId },
                        data: { pdfUrl: poPdfPath },
                    });
                    await db_1.prisma.invoice.update({
                        where: { id: result.invoice.id },
                        data: { pdfUrl: invPdfPath },
                    });
                    // 3. Email PDFs to Vendor
                    const poFilename = `po_${poData.poNumber}.pdf`;
                    const invFilename = `invoice_${result.invoice.invoiceNumber}.pdf`;
                    const poDiskPath = path_1.default.join(process.cwd(), "public", "pdfs", poFilename);
                    const invDiskPath = path_1.default.join(process.cwd(), "public", "pdfs", invFilename);
                    await (0, mailer_1.sendEmail)({
                        to: vendor.email,
                        subject: `VendorBridge - Approved Purchase Order ${poData.poNumber}`,
                        text: `Hello ${vendor.name},\n\nWe are pleased to inform you that your quotation has been selected. Please find attached the Purchase Order (${poData.poNumber}) and the corresponding Invoice (${result.invoice.invoiceNumber}).\n\nBest Regards,\nProcurement Team`,
                        html: `<p>Hello <strong>${vendor.name}</strong>,</p><p>We are pleased to inform you that your quotation has been selected.</p><p>Please find attached the <strong>Purchase Order (${poData.poNumber})</strong> and the corresponding <strong>Invoice (${result.invoice.invoiceNumber})</strong>.</p><p>Best Regards,<br/>Procurement Team</p>`,
                        attachments: [
                            { filename: poFilename, path: poDiskPath },
                            { filename: invFilename, path: invDiskPath },
                        ],
                    });
                }
                catch (error) {
                    console.error("PDF generation or email failed: ", error);
                }
            }
            return result.po;
        });
    }
    // Invoice listing and query methods
    async getInvoices(role, vendorProfileId) {
        if (role === "VENDOR") {
            return poRepository_1.poRepository.findAllInvoices({ vendorId: vendorProfileId || undefined });
        }
        return poRepository_1.poRepository.findAllInvoices();
    }
    async getInvoiceById(id, role, vendorProfileId) {
        const invoice = await poRepository_1.poRepository.findInvoiceById(id);
        if (!invoice) {
            throw new errors_1.NotFoundError("Invoice not found");
        }
        if (role === "VENDOR" && invoice.purchaseOrder.quotation.vendorId !== vendorProfileId) {
            throw new errors_1.ForbiddenError("You are not authorized to view this invoice");
        }
        return invoice;
    }
}
exports.POService = POService;
exports.poService = new POService();
