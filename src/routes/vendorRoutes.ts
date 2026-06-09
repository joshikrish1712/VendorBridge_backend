import { Router } from "express";
import { vendorController } from "../controllers/vendorController";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize([Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.MANAGER]),
  vendorController.getAll
);

router.get("/:id", vendorController.getById);

router.put("/:id", vendorController.update);

router.patch(
  "/:id/status",
  authorize([Role.ADMIN]),
  vendorController.updateStatus
);

export default router;
