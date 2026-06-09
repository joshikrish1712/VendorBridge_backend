import { z } from "zod";

export const createPoSchema = z.object({
  quotationId: z.string().uuid("Invalid Quotation ID"),
  termsAndConditions: z.string().max(1000, "Terms must not exceed 1000 characters").optional(),
});

export const approvePoSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"], {
    errorMap: () => ({ message: "Action must be either APPROVED or REJECTED" }),
  }),
  remarks: z.string().max(500, "Remarks must not exceed 500 characters").optional(),
});
