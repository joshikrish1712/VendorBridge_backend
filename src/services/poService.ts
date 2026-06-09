import { poRepository } from "../repositories/poRepository";
import { POStatus, InvoiceStatus, RFQStatus } from "@prisma/client";
import { NotFoundError, BadRequestError, ForbiddenError } from "../utils/errors";
import { activityLogService } from "./activityLogService";
import { generateDocumentPDF } from "../utils/pdfGenerator";
import { sendEmail } from "../config/mailer";
import { prisma } from "../config/db";
import path from "path";

export class POService {
  async createPO(
    userId: string,
    data: {
      quotationId: string;
      termsAndConditions?: string;
    }
  ) {
    const quotation = await prisma.quotation.findUnique({
      where: { id: data.quotationId },
      include: { rfq: true, vendor: true },
    });

    if (!quotation) {
      throw new NotFoundError("Quotation not found");
    }

    if (quotation.rfq.status !== RFQStatus.PUBLISHED && quotation.rfq.status !== RFQStatus.UNDER_REVIEW) {
      throw new BadRequestError("RFQ is not in a valid status for selection");
    }

    // Auto-generate PO Number: PO-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    const po = await poRepository.create({
      poNumber,
      quotationId: data.quotationId,
      totalAmount: quotation.price,
      termsAndConditions: data.termsAndConditions,
    });

    await activityLogService.log(userId, "PO_DRAFT_CREATED", {
      poId: po.id,
      poNumber,
      quotationId: data.quotationId,
    });

    return po;
  }

  async getPOs(role: string, vendorProfileId: string | null) {
    if (role === "VENDOR") {
      return poRepository.findAll({ vendorId: vendorProfileId || undefined });
    }
    return poRepository.findAll();
  }

  async getPOById(id: string, role: string, vendorProfileId: string | null) {
    const po = await poRepository.findById(id);
    if (!po) {
      throw new NotFoundError("Purchase Order not found");
    }

    if (role === "VENDOR" && po.quotation.vendorId !== vendorProfileId) {
      throw new ForbiddenError("You are not authorized to view this Purchase Order");
    }

    return po;
  }

  async processApproval(
    userId: string,
    userName: string,
    poId: string,
    action: "APPROVED" | "REJECTED",
    remarks?: string
  ) {
    const po = await poRepository.findById(poId);
    if (!po) {
      throw new NotFoundError("Purchase Order not found");
    }

    if (po.status !== POStatus.PENDING_APPROVAL) {
      throw new BadRequestError(`Purchase Order is not pending approval. Status: ${po.status}`);
    }

    const nextStatus = action === "APPROVED" ? POStatus.APPROVED : POStatus.REJECTED;

    return prisma.$transaction(async (tx) => {
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
      if (nextStatus === POStatus.APPROVED) {
        // Update RFQ status to COMPLETED
        await tx.rFQ.update({
          where: { id: updatedPo.quotation.rfqId },
          data: { status: RFQStatus.COMPLETED },
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
            status: InvoiceStatus.UNPAID,
          },
        });

        // Trigger Async PDF generation and email delivery (will resolve after transaction commits, but we can generate paths now)
        // We will run this outside or inside but we shouldn't block the transaction too long.
        // Let's execute the email trigger right after transaction finishes
        return { po: updatedPo, invoice, triggerEmail: true };
      }

      // If rejected, set RFQ back to PUBLISHED so other quotations can be selected
      if (nextStatus === POStatus.REJECTED) {
        await tx.rFQ.update({
          where: { id: updatedPo.quotation.rfqId },
          data: { status: RFQStatus.PUBLISHED },
        });
        await tx.quotation.update({
          where: { id: updatedPo.quotationId },
          data: { status: "SUBMITTED" }, // reset status
        });
      }

      return { po: updatedPo, invoice: null, triggerEmail: false };
    }).then(async (result) => {
      await activityLogService.log(userId, `PO_${action}`, { poId, remarks });

      if (result.triggerEmail && result.invoice) {
        // Run generation of PDFs and send email
        try {
          const poData = result.po;
          const vendor = poData.quotation.vendor;

          // 1. Generate PO PDF
          const poPdfPath = await generateDocumentPDF(
            {
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
            },
            "po"
          );

          // 2. Generate Invoice PDF
          const invPdfPath = await generateDocumentPDF(
            {
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
            },
            "invoice"
          );

          // Update PDF URLs in database
          await prisma.purchaseOrder.update({
            where: { id: poId },
            data: { pdfUrl: poPdfPath },
          });

          await prisma.invoice.update({
            where: { id: result.invoice.id },
            data: { pdfUrl: invPdfPath },
          });

          // 3. Email PDFs to Vendor
          const poFilename = `po_${poData.poNumber}.pdf`;
          const invFilename = `invoice_${result.invoice.invoiceNumber}.pdf`;
          const poDiskPath = path.join(process.cwd(), "public", "pdfs", poFilename);
          const invDiskPath = path.join(process.cwd(), "public", "pdfs", invFilename);

          await sendEmail({
            to: vendor.email,
            subject: `VendorBridge - Approved Purchase Order ${poData.poNumber}`,
            text: `Hello ${vendor.name},\n\nWe are pleased to inform you that your quotation has been selected. Please find attached the Purchase Order (${poData.poNumber}) and the corresponding Invoice (${result.invoice.invoiceNumber}).\n\nBest Regards,\nProcurement Team`,
            html: `<p>Hello <strong>${vendor.name}</strong>,</p><p>We are pleased to inform you that your quotation has been selected.</p><p>Please find attached the <strong>Purchase Order (${poData.poNumber})</strong> and the corresponding <strong>Invoice (${result.invoice.invoiceNumber})</strong>.</p><p>Best Regards,<br/>Procurement Team</p>`,
            attachments: [
              { filename: poFilename, path: poDiskPath },
              { filename: invFilename, path: invDiskPath },
            ],
          });
        } catch (error) {
          console.error("PDF generation or email failed: ", error);
        }
      }

      return result.po;
    });
  }

  // Invoice listing and query methods
  async getInvoices(role: string, vendorProfileId: string | null) {
    if (role === "VENDOR") {
      return poRepository.findAllInvoices({ vendorId: vendorProfileId || undefined });
    }
    return poRepository.findAllInvoices();
  }

  async getInvoiceById(id: string, role: string, vendorProfileId: string | null) {
    const invoice = await poRepository.findInvoiceById(id);
    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    if (role === "VENDOR" && invoice.purchaseOrder.quotation.vendorId !== vendorProfileId) {
      throw new ForbiddenError("You are not authorized to view this invoice");
    }

    return invoice;
  }
}

export const poService = new POService();
