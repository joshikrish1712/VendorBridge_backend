"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvePoSchema = exports.createPoSchema = void 0;
const zod_1 = require("zod");
exports.createPoSchema = zod_1.z.object({
    quotationId: zod_1.z.string().uuid("Invalid Quotation ID"),
    termsAndConditions: zod_1.z.string().max(1000, "Terms must not exceed 1000 characters").optional(),
});
exports.approvePoSchema = zod_1.z.object({
    action: zod_1.z.enum(["APPROVED", "REJECTED"], {
        errorMap: () => ({ message: "Action must be either APPROVED or REJECTED" }),
    }),
    remarks: zod_1.z.string().max(500, "Remarks must not exceed 500 characters").optional(),
});
