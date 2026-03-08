import nodemailer from "nodemailer";

export function createSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.in",
    port: parseInt(process.env.ZOHO_SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
  });
}
