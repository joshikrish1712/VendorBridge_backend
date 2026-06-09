"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRfqStatusSchema = exports.assignVendorsSchema = exports.createRfqSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createRfqSchema = zod_1.z.object({
    title: zod_1.z.string().min(5, "Title must be at least 5 characters"),
    description: zod_1.z.string().min(10, "Description must be at least 10 characters"),
    deadline: zod_1.z.string().datetime({ message: "Invalid ISO datetime format for deadline" }),
    vendorIds: zod_1.z.array(zod_1.z.string()).min(1, "Assign at least one vendor"),
    documents: zod_1.z
        .array(zod_1.z.object({
        fileName: zod_1.z.string().min(1, "Filename is required"),
        fileUrl: zod_1.z.string().url("Invalid file URL"),
    }))
        .optional(),
});
exports.assignVendorsSchema = zod_1.z.object({
    vendorIds: zod_1.z.array(zod_1.z.string()).min(1, "Provide at least one vendor ID"),
});
exports.updateRfqStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.RFQStatus),
});
