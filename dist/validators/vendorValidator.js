"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateVendorStatusSchema = exports.updateVendorSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.updateVendorSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Vendor name must be at least 2 characters").optional(),
    phone: zod_1.z.string().min(10, "Phone number must be at least 10 characters").optional(),
    address: zod_1.z.string().min(5, "Address must be at least 5 characters").optional(),
    categories: zod_1.z.array(zod_1.z.string()).min(1, "At least one category is required").optional(),
    gstNumber: zod_1.z
        .string()
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format")
        .optional(),
});
exports.updateVendorStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.VendorStatus),
});
