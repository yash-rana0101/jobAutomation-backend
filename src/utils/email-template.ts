interface SenderProfile {
  name: string;
  phone: string;
  location: string;
  email: string;
  linkedin?: string | null;
  website?: string | null;
}

/** Convert plain-text email body + sender profile → branded HTML email */
export function buildEmailHtml(body: string, profile: SenderProfile): string {
  // Escape HTML entities, then convert paragraphs/line breaks
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  const linkedinLink = profile.linkedin
    ? `&nbsp;·&nbsp;<a href="${profile.linkedin}" style="color:#FF6500;text-decoration:none;">LinkedIn</a>`
    : "";
  const websiteLink = profile.website
    ? `&nbsp;·&nbsp;<a href="${profile.website}" style="color:#FF6500;text-decoration:none;">Portfolio</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email from ${profile.name}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:10px;overflow:hidden;
                      border:1px solid #e2e6ea;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

          <!-- Header band -->
          <tr>
            <td style="background:linear-gradient(135deg,#0B192C 0%,#1E3E62 100%);
                        padding:26px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;
                         color:#FF6500;letter-spacing:0.4px;">${profile.name}</p>
              <p style="margin:5px 0 0;font-size:12px;color:#aec8e8;">
                Full Stack Engineer &nbsp;·&nbsp; Backend &amp; Cloud Systems
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;color:#1a1a1a;font-size:14px;line-height:1.75;">
              ${paragraphs}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e8ecef;margin:0;" />
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:20px 32px 28px;">
              <p style="margin:0;font-size:15px;font-weight:700;color:#0B192C;">
                ${profile.name}
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#555555;line-height:1.9;">
                ${profile.phone} &nbsp;·&nbsp; ${profile.location}<br />
                <a href="mailto:${profile.email}"
                   style="color:#FF6500;text-decoration:none;">${profile.email}</a>
                ${linkedinLink}${websiteLink}
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <p style="margin:16px 0 0;font-size:11px;color:#aaa;">
          Sent via Outreach AI — automated cold email system
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
