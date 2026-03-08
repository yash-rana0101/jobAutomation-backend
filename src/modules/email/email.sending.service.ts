import { createSmtpTransport } from "../../config/smtp";
import prisma from "../../config/database";
import fs from "fs";
import path from "path";

export async function sendEmail(companyId: string) {
  const outreach = await prisma.outreach.findUnique({
    where: { companyId },
    include: { company: true },
  });
  if (!outreach) throw new Error("Outreach record not found");
  if (outreach.status !== "approved") {
    throw new Error("Email must be approved before sending");
  }

  const transport = createSmtpTransport();

  const mailOptions: any = {
    from: `"Yash Rana" <${process.env.ZOHO_SMTP_USER}>`,
    to: outreach.company.email,
    subject: outreach.emailSubject,
    text: outreach.emailBody || "",
  };

  // Attach resume if available
  if (outreach.resumePath) {
    const fullPath = path.join(process.cwd(), outreach.resumePath);
    if (fs.existsSync(fullPath)) {
      mailOptions.attachments = [
        {
          filename: path.basename(fullPath),
          path: fullPath,
        },
      ];
    }
  }

  try {
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "sending" },
    });

    await transport.sendMail(mailOptions);

    await prisma.outreach.update({
      where: { companyId },
      data: { status: "sent", sentAt: new Date() },
    });

    return { success: true };
  } catch (error: any) {
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "failed", errorMessage: error.message },
    });
    throw error;
  }
}
