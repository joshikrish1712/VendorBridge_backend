import { Router } from "express";
import { poController } from "../controllers/poController";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

// Purchase Orders CRUD
router.post(
  "/",
  authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER]),
  poController.create
);
router.get("/", poController.getAll);

// Invoices Queries
router.get("/invoices", poController.getAllInvoices);
router.get("/invoices/:id", poController.getInvoiceById);

// PDF Downloads
router.get("/pdf/:type/:number", poController.downloadPDF);

// Actions
router.post(
  "/:id/approve",
  authorize([Role.ADMIN, Role.MANAGER]),
  poController.approve
);
router.get("/:id", poController.getById);

export default router;
