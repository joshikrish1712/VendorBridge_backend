import nodemailer from "nodemailer";
import { logger } from "./logger";

let transporter: nodemailer.Transporter;

export async function initMailer() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtp.ethereal.email";
  const port = parseInt(process.env.SMTP_PORT || "587");
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    try {
      logger.info("SMTP credentials not provided. Generating Ethereal test account...");
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      logger.info(`Ethereal email created: User=${user}, Pass=${pass}`);
    } catch (error) {
      logger.error("Failed to generate Ethereal account, falling back to dummy transporter config: %O", error);
      user = "dummy";
      pass = "dummy";
    }
  }

  transporter = nodemailer.createTransport({
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

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: any[];
}) {
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

    logger.info(`Email sent: ${info.messageId}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`Email preview URL: ${previewUrl}`);
    }
    return info;
  } catch (error) {
    logger.error("Error sending email: %O", error);
    throw error;
  }
}
