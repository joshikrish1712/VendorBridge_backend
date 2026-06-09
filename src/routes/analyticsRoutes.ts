import { Router } from "express";
import { analyticsController } from "../controllers/analyticsController";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

router.get(
  "/summary",
  authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.MANAGER]),
  analyticsController.getDashboardSummary
);

router.get(
  "/logs",
  authorize([Role.ADMIN]),
  analyticsController.getAuditLogs
);

export default router;
