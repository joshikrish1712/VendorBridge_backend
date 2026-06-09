import { PrismaClient, Role, VendorStatus, RFQStatus, POStatus, InvoiceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data in correct dependency order
  await prisma.activityLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.approvalHistory.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.rFQDocument.deleteMany();
  await prisma.rFQVendor.deleteMany();
  await prisma.rFQ.deleteMany();
  await prisma.user.deleteMany();
  await prisma.vendor.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Core Users
  await prisma.user.create({
    data: {
      email: "admin@vendorbridge.com",
      name: "Alice Admin",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const officer = await prisma.user.create({
    data: {
      email: "officer@vendorbridge.com",
      name: "Peter Officer",
      passwordHash,
      role: Role.PROCUREMENT_OFFICER,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@vendorbridge.com",
      name: "Mary Manager",
      passwordHash,
      role: Role.MANAGER,
    },
  });

  console.log("Core users created: Admin, Procurement Officer, Manager.");

  // 2. Create Vendors
  const vendorA = await prisma.vendor.create({
    data: {
      name: "Global Tech Solutions",
      email: "vendor-a@vendorbridge.com",
      phone: "9876543210",
      status: VendorStatus.APPROVED,
      categories: ["Hardware", "IT Services"],
      gstNumber: "27AAAAA1111A1Z1",
      address: "123 Technology Lane, Silicon Valley",
      rating: 4.5,
    },
  });

  const userA = await prisma.user.create({
    data: {
      email: "vendor-a@vendorbridge.com",
      name: "Valerie Vendor A",
      passwordHash,
      role: Role.VENDOR,
      vendorProfileId: vendorA.id,
    },
  });

  const vendorB = await prisma.vendor.create({
    data: {
      name: "Office Supplies Corp",
      email: "vendor-b@vendorbridge.com",
      phone: "8765432109",
      status: VendorStatus.APPROVED,
      categories: ["Office Stationery", "Furniture"],
      gstNumber: "27BBBBB2222B2Z2",
      address: "456 Commerce Boulevard, New York",
      rating: 4.0,
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: "vendor-b@vendorbridge.com",
      name: "Victor Vendor B",
      passwordHash,
      role: Role.VENDOR,
      vendorProfileId: vendorB.id,
    },
  });

  const vendorC = await prisma.vendor.create({
    data: {
      name: "Logistics Experts Ltd",
      email: "vendor-c@vendorbridge.com",
      phone: "7654321098",
      status: VendorStatus.PENDING,
      categories: ["Shipping", "Storage"],
      gstNumber: "27CCCCC3333C3Z3",
      address: "789 Freight Highway, Chicago",
      rating: 0.0,
    },
  });

  await prisma.user.create({
    data: {
      email: "vendor-c@vendorbridge.com",
      name: "Vince Vendor C",
      passwordHash,
      role: Role.VENDOR,
      vendorProfileId: vendorC.id,
      isActive: false, // Pending vendors are inactive
    },
  });

  console.log("Vendors and contact users created (2 Approved, 1 Pending).");

  // 3. Create RFQs
  // RFQ 1: Draft
  const rfqDraft = await prisma.rFQ.create({
    data: {
      rfqNumber: "RFQ-2026-0001",
      title: "Laptop Procurement Q3",
      description: "Request for quotes to purchase 50 Developer Laptops (32GB RAM, 1TB SSD).",
      status: RFQStatus.DRAFT,
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      createdById: officer.id,
    },
  });

  await prisma.rFQVendor.create({
    data: {
      rfqId: rfqDraft.id,
      vendorId: vendorA.id,
      status: "INVITED",
    },
  });

  // RFQ 2: Published with Quotations
  const rfqPublished = await prisma.rFQ.create({
    data: {
      rfqNumber: "RFQ-2026-0002",
      title: "Office Furniture Revamp",
      description: "Procuring ergonomic office chairs (100 units) and height-adjustable desks (50 units).",
      status: RFQStatus.PUBLISHED,
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      createdById: officer.id,
    },
  });

  await prisma.rFQVendor.createMany({
    data: [
      { rfqId: rfqPublished.id, vendorId: vendorA.id, status: "SUBMITTED" },
      { rfqId: rfqPublished.id, vendorId: vendorB.id, status: "SUBMITTED" },
    ],
  });

  console.log("RFQs created (1 Draft, 1 Published).");

  // 4. Create Quotations for RFQ 2
  // Quotation A (Global Tech Solutions)
  const quoteA = await prisma.quotation.create({
    data: {
      rfqId: rfqPublished.id,
      vendorId: vendorA.id,
      submittedById: userA.id,
      price: 15500.0,
      deliveryTimeline: 10, // 10 days
      remarks: "High quality steel frames, 5 year warranty.",
      status: "SUBMITTED",
    },
  });

  await prisma.quotationItem.createMany({
    data: [
      {
        quotationId: quoteA.id,
        description: "Ergonomic Office Chairs",
        quantity: 100,
        unitPrice: 85.0,
        totalPrice: 8500.0,
      },
      {
        quotationId: quoteA.id,
        description: "Height-Adjustable Desks",
        quantity: 50,
        unitPrice: 140.0,
        totalPrice: 7000.0,
      },
    ],
  });

  // Quotation B (Office Supplies Corp)
  const quoteB = await prisma.quotation.create({
    data: {
      rfqId: rfqPublished.id,
      vendorId: vendorB.id,
      submittedById: userB.id,
      price: 14500.0, // Cheaper!
      deliveryTimeline: 15, // Longer delivery
      remarks: "Eco-friendly wood build, 3 year warranty.",
      status: "SUBMITTED",
    },
  });

  await prisma.quotationItem.createMany({
    data: [
      {
        quotationId: quoteB.id,
        description: "Ergonomic Office Chairs",
        quantity: 100,
        unitPrice: 75.0,
        totalPrice: 7500.0,
      },
      {
        quotationId: quoteB.id,
        description: "Height-Adjustable Desks",
        quantity: 50,
        unitPrice: 140.0,
        totalPrice: 7000.0,
      },
    ],
  });

  console.log("Quotations submitted by Vendor A and Vendor B.");

  // 5. Create a completed cycle (RFQ -> SELECTED -> PO APPROVED -> INVOICE)
  const rfqCompleted = await prisma.rFQ.create({
    data: {
      rfqNumber: "RFQ-2026-0003",
      title: "Stationery Supplies Batch 1",
      description: "Monthly purchase of pens, papers, notebooks.",
      status: RFQStatus.COMPLETED,
      deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // past deadline
      createdById: officer.id,
    },
  });

  await prisma.rFQVendor.create({
    data: {
      rfqId: rfqCompleted.id,
      vendorId: vendorB.id,
      status: "SUBMITTED",
    },
  });

  const quoteCompleted = await prisma.quotation.create({
    data: {
      rfqId: rfqCompleted.id,
      vendorId: vendorB.id,
      submittedById: userB.id,
      price: 1200.0,
      deliveryTimeline: 3,
      status: "SELECTED",
      pdfUrl: "/static/pdfs/quote_completed.pdf",
    },
  });

  await prisma.quotationItem.create({
    data: {
      quotationId: quoteCompleted.id,
      description: "A4 Size Paper Boxes (50 units) + Gel Pens (100 units)",
      quantity: 1,
      unitPrice: 1200.0,
      totalPrice: 1200.0,
    },
  });

  const poCompleted = await prisma.purchaseOrder.create({
    data: {
      poNumber: "PO-2026-0001",
      quotationId: quoteCompleted.id,
      status: POStatus.APPROVED,
      totalAmount: 1200.0,
      termsAndConditions: "Standard stationery purchase terms. Deliver immediately.",
      approvedById: manager.id,
      approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      remarks: "Lowest cost, looks good.",
      pdfUrl: "/static/pdfs/po_PO-2026-0001.pdf",
    },
  });

  await prisma.approvalHistory.create({
    data: {
      purchaseOrderId: poCompleted.id,
      userId: manager.id,
      userName: manager.name,
      action: "APPROVED",
      remarks: "Lowest cost, looks good.",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-0001",
      purchaseOrderId: poCompleted.id,
      status: InvoiceStatus.UNPAID,
      amount: 1200.0,
      taxAmount: 216.0, // 18% GST
      totalAmount: 1416.0,
      dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // due 28 days
      pdfUrl: "/static/pdfs/invoice_INV-2026-0001.pdf",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // 6. Logs
  await prisma.activityLog.createMany({
    data: [
      { action: "SYSTEM_STARTUP", details: "Database successfully seeded" },
      { userId: officer.id, action: "RFQ_CREATED", details: '{"rfqId":"draft"}' },
      { userId: userA.id, action: "QUOTATION_SUBMITTED", details: '{"totalPrice":15500}' },
      { userId: userB.id, action: "QUOTATION_SUBMITTED", details: '{"totalPrice":14500}' },
      { userId: manager.id, action: "PO_APPROVED", details: '{"poId":"completed"}' },
    ],
  });

  console.log("Completed PO cycle created and activity logs written.");
  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
