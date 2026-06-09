import { z } from "zod";
import { RFQStatus } from "@prisma/client";

export const createRfqSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  deadline: z.string().datetime({ message: "Invalid ISO datetime format for deadline" }),
  vendorIds: z.array(z.string()).min(1, "Assign at least one vendor"),
  documents: z
    .array(
      z.object({
        fileName: z.string().min(1, "Filename is required"),
        fileUrl: z.string().url("Invalid file URL"),
      })
    )
    .optional(),
});

export const assignVendorsSchema = z.object({
  vendorIds: z.array(z.string()).min(1, "Provide at least one vendor ID"),
});

export const updateRfqStatusSchema = z.object({
  status: z.nativeEnum(RFQStatus),
});
