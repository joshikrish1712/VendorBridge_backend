import { Router } from "express";
import { quotationController } from "../controllers/quotationController";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

router.post("/", authorize([Role.VENDOR]), quotationController.submit);
router.get("/vendor/my", authorize([Role.VENDOR]), quotationController.getVendorQuotations);
router.get("/rfq/:rfqId", authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.MANAGER]), quotationController.getByRFQ);
router.get("/rfq/:rfqId/compare", authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.MANAGER]), quotationController.compare);
router.get("/:id", quotationController.getById);

export default router;
