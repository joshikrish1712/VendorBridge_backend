"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuotationSchema = void 0;
const zod_1 = require("zod");
exports.createQuotationSchema = zod_1.z.object({
    rfqId: zod_1.z.string().uuid("Invalid RFQ ID"),
    deliveryTimeline: zod_1.z.number().int().positive("Delivery timeline must be a positive integer (number of days)"),
    remarks: zod_1.z.string().max(500, "Remarks must not exceed 500 characters").optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        description: zod_1.z.string().min(3, "Item description must be at least 3 characters"),
        quantity: zod_1.z.number().int().positive("Quantity must be a positive integer"),
        unitPrice: zod_1.z.number().positive("Unit price must be greater than zero"),
    }))
        .min(1, "Quotation must contain at least one line item"),
});
