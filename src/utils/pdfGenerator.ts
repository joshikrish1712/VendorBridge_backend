import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { logger } from "../config/logger";

interface PDFItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface PDFData {
  title: string;
  number: string;
  date: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorAddress: string;
  vendorGST: string;
  items: PDFItem[];
  subtotal: number;
  tax?: number;
  total: number;
  terms?: string;
}

export function generateDocumentPDF(data: PDFData, type: "po" | "invoice"): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const dirPath = path.join(process.cwd(), "public", "pdfs");
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const filename = `${type}_${data.number}.pdf`;
      const filePath = path.join(dirPath, filename);
      const doc = new PDFDocument({ margin: 50 });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- HEADER ---
      doc
        .fillColor("#1e3a8a")
        .fontSize(20)
        .text("VendorBridge ERP", 50, 50)
        .fontSize(10)
        .fillColor("#4b5563")
        .text("100 Corporate Drive, Tech Park", 50, 75)
        .text("contact@vendorbridge.com | +1-800-555-0199", 50, 90);

      doc
        .fillColor("#1e3a8a")
        .fontSize(18)
        .text(data.title.toUpperCase(), 350, 50, { align: "right" })
        .fontSize(10)
        .fillColor("#4b5563")
        .text(`${type.toUpperCase()} #: ${data.number}`, 350, 75, { align: "right" })
        .text(`Date: ${data.date}`, 350, 90, { align: "right" });

      doc.moveTo(50, 115).lineTo(550, 115).strokeColor("#e5e7eb").stroke();

      // --- VENDOR DETAILS ---
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .text("Vendor Profile Details:", 50, 130, { underline: true })
        .fontSize(10)
        .text(`Name: ${data.vendorName}`, 50, 150)
        .text(`GSTIN: ${data.vendorGST}`, 50, 165)
        .text(`Email: ${data.vendorEmail}`, 50, 180)
        .text(`Phone: ${data.vendorPhone}`, 50, 195)
        .text(`Address: ${data.vendorAddress}`, 50, 210);

      doc.moveTo(50, 235).lineTo(550, 235).strokeColor("#e5e7eb").stroke();

      // --- ITEMS TABLE ---
      let y = 250;
      doc
        .fillColor("#1e3a8a")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Description", 50, y)
        .text("Quantity", 280, y, { width: 60, align: "right" })
        .text("Unit Price", 360, y, { width: 80, align: "right" })
        .text("Total", 460, y, { width: 90, align: "right" });

      doc.moveTo(50, y + 15).lineTo(550, y + 15).strokeColor("#9ca3af").stroke();
      y += 20;

      doc.fillColor("#374151").font("Helvetica");
      data.items.forEach((item) => {
        // Draw item row
        doc
          .text(item.description, 50, y, { width: 220 })
          .text(item.quantity.toString(), 280, y, { width: 60, align: "right" })
          .text(`$${Number(item.unitPrice).toFixed(2)}`, 360, y, { width: 80, align: "right" })
          .text(`$${Number(item.totalPrice).toFixed(2)}`, 460, y, { width: 90, align: "right" });

        y += doc.heightOfString(item.description, { width: 220 }) + 10;
      });

      doc.moveTo(50, y).lineTo(550, y).strokeColor("#e5e7eb").stroke();
      y += 10;

      // --- TOTALS ---
      doc
        .text("Subtotal:", 350, y, { width: 90, align: "right" })
        .text(`$${data.subtotal.toFixed(2)}`, 460, y, { width: 90, align: "right" });
      y += 15;

      if (data.tax !== undefined) {
        doc
          .text("GST Tax (18%):", 350, y, { width: 90, align: "right" })
          .text(`$${data.tax.toFixed(2)}`, 460, y, { width: 90, align: "right" });
        y += 15;
      }

      doc
        .fillColor("#1e3a8a")
        .font("Helvetica-Bold")
        .text("Total Amount:", 350, y, { width: 90, align: "right" })
        .text(`$${data.total.toFixed(2)}`, 460, y, { width: 90, align: "right" })
        .font("Helvetica");
      y += 30;

      // --- TERMS & CONDITIONS ---
      if (data.terms) {
        doc
          .fillColor("#1f2937")
          .fontSize(10)
          .text("Terms and Conditions:", 50, y, { underline: true })
          .fillColor("#4b5563")
          .fontSize(8)
          .text(data.terms, 50, y + 15, { width: 500 });
      }

      // --- FOOTER ---
      doc
        .fillColor("#9ca3af")
        .fontSize(8)
        .text(
          "Thank you for doing business with VendorBridge. This is a computer-generated document.",
          50,
          700,
          { align: "center", width: 500 }
        );

      doc.end();

      stream.on("finish", () => {
        logger.info(`PDF successfully written: ${filePath}`);
        // Return a relative URL path or absolute local path
        // For local server, we return the relative public path
        resolve(`/static/pdfs/${filename}`);
      });

      stream.on("error", (err) => {
        logger.error(`Error writing PDF file stream: %O`, err);
        reject(err);
      });
    } catch (error) {
      logger.error(`Failed to generate PDF: %O`, error);
      reject(error);
    }
  });
}
