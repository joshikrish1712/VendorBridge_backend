"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const poController_1 = require("../controllers/poController");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Purchase Orders CRUD
router.post("/", (0, auth_1.authorize)([client_1.Role.ADMIN, client_1.Role.PROCUREMENT_OFFICER]), poController_1.poController.create);
router.get("/", poController_1.poController.getAll);
// Invoices Queries
router.get("/invoices", poController_1.poController.getAllInvoices);
router.get("/invoices/:id", poController_1.poController.getInvoiceById);
// PDF Downloads
router.get("/pdf/:type/:number", poController_1.poController.downloadPDF);
// Actions
router.post("/:id/approve", (0, auth_1.authorize)([client_1.Role.ADMIN, client_1.Role.MANAGER]), poController_1.poController.approve);
router.get("/:id", poController_1.poController.getById);
exports.default = router;
