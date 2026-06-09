import { Router } from "express";
import { rfqController } from "../controllers/rfqController";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

router.get("/", rfqController.getAll);
router.post(
  "/",
  authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER]),
  rfqController.create
);
router.get("/:id", rfqController.getById);
router.post(
  "/:id/assign",
  authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER]),
  rfqController.assignVendors
);
router.patch(
  "/:id/status",
  authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER]),
  rfqController.updateStatus
);

export default router;
