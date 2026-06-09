"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.signupSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    name: zod_1.z.string().min(2, "Name must be at least 2 characters"),
    role: zod_1.z.nativeEnum(client_1.Role),
    vendorDetails: zod_1.z
        .object({
        name: zod_1.z.string().min(2, "Vendor name must be at least 2 characters"),
        phone: zod_1.z.string().min(10, "Phone number must be at least 10 characters"),
        gstNumber: zod_1.z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format"),
        address: zod_1.z.string().min(5, "Address must be at least 5 characters"),
        categories: zod_1.z.array(zod_1.z.string()).min(1, "At least one category is required"),
    })
        .optional(),
}).refine((data) => {
    if (data.role === client_1.Role.VENDOR && !data.vendorDetails) {
        return false;
    }
    return true;
}, {
    message: "Vendor details are required when role is VENDOR",
    path: ["vendorDetails"],
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Token is required"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
