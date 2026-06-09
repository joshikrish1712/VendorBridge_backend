"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initMailer = initMailer;
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("./logger");
let transporter;
async function initMailer() {
    if (transporter)
        return transporter;
    const host = process.env.SMTP_HOST || "smtp.ethereal.email";
    const port = parseInt(process.env.SMTP_PORT || "587");
    let user = process.env.SMTP_USER;
    let pass = process.env.SMTP_PASS;
    if (!user || !pass) {
        try {
            logger_1.logger.info("SMTP credentials not provided. Generating Ethereal test account...");
            const testAccount = await nodemailer_1.default.createTestAccount();
            user = testAccount.user;
            pass = testAccount.pass;
            logger_1.logger.info(`Ethereal email created: User=${user}, Pass=${pass}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to generate Ethereal account, falling back to dummy transporter config: %O", error);
            user = "dummy";
            pass = "dummy";
        }
    }
    transporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    });
    return transporter;
}
async function sendEmail({ to, subject, text, html, attachments, }) {
    try {
        const client = await initMailer();
        const info = await client.sendMail({
            from: process.env.SMTP_FROM || '"VendorBridge" <noreply@vendorbridge.com>',
            to,
            subject,
            text,
            html,
            attachments,
        });
        logger_1.logger.info(`Email sent: ${info.messageId}`);
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        if (previewUrl) {
            logger_1.logger.info(`Email preview URL: ${previewUrl}`);
        }
        return info;
    }
    catch (error) {
        logger_1.logger.error("Error sending email: %O", error);
        throw error;
    }
}
