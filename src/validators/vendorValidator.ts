import { z } from "zod";
import { VendorStatus } from "@prisma/client";

export const updateVendorSchema = z.object({
  name: z.string().min(2, "Vendor name must be at least 2 characters").optional(),
  phone: z.string().min(10, "Phone number must be at least 10 characters").optional(),
  address: z.string().min(5, "Address must be at least 5 characters").optional(),
  categories: z.array(z.string()).min(1, "At least one category is required").optional(),
  gstNumber: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format")
    .optional(),
});

export const updateVendorStatusSchema = z.object({
  status: z.nativeEnum(VendorStatus),
});
