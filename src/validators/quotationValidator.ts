import { z } from "zod";

export const createQuotationSchema = z.object({
  rfqId: z.string().uuid("Invalid RFQ ID"),
  deliveryTimeline: z.number().int().positive("Delivery timeline must be a positive integer (number of days)"),
  remarks: z.string().max(500, "Remarks must not exceed 500 characters").optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(3, "Item description must be at least 3 characters"),
        quantity: z.number().int().positive("Quantity must be a positive integer"),
        unitPrice: z.number().positive("Unit price must be greater than zero"),
      })
    )
    .min(1, "Quotation must contain at least one line item"),
});
