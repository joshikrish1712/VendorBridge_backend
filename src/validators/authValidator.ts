import { z } from "zod";
import { Role } from "@prisma/client";

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.nativeEnum(Role),
  vendorDetails: z
    .object({
      name: z.string().min(2, "Vendor name must be at least 2 characters"),
      phone: z.string().min(10, "Phone number must be at least 10 characters"),
      gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format"),
      address: z.string().min(5, "Address must be at least 5 characters"),
      categories: z.array(z.string()).min(1, "At least one category is required"),
    })
    .optional(),
}).refine(
  (data) => {
    if (data.role === Role.VENDOR && !data.vendorDetails) {
      return false;
    }
    return true;
  },
  {
    message: "Vendor details are required when role is VENDOR",
    path: ["vendorDetails"],
  }
);

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().min(6, "OTP must be at least 6 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
