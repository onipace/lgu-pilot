import nodemailer from "nodemailer";

// ═══════════════════════════════════════════════════════════
// EMAIL SERVICE — Nodemailer SMTP transport
// ═══════════════════════════════════════════════════════════

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env"
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@bayanaihan.net";
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_ESANGGUNI_URL || "https://esangguni.bayanaihan.net";
}

// ── Email Templates ────────────────────────────────────────

interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(opts: SendOptions): Promise<boolean> {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `eSANGGUNI <${getFromAddress()}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    console.log(`[email] Sent to ${opts.to}: "${opts.subject}" (${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send to ${opts.to}:`, err);
    return false;
  }
}

// ── Public Functions ───────────────────────────────────────

/**
 * Send registration confirmation (account pending approval)
 */
export async function sendRegistrationConfirmation(
  email: string,
  fullName: string
): Promise<boolean> {
  const appUrl = getAppUrl();

  return sendEmail({
    to: email,
    subject: "eSANGGUNI Registration Received — Awaiting Approval",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2c2c2c;">
        <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #e5e7eb;">
          <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #1a1a2e;">eSANGGUNI</h1>
          <p style="font-size: 12px; color: #666; margin-top: 8px;">Smart Legislation — AI for Local Government</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #16213e;">Hello ${escapeHtml(fullName)},</h2>
          <p>Thank you for registering with eSANGGUNI. Your registration has been received and is currently <strong>pending admin approval</strong>.</p>

          <div style="background: #f0f4ff; border-left: 4px solid #4f6df5; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px;"><strong>What happens next?</strong></p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #555;">An administrator will review your registration request. You will receive an email notification once your account has been approved.</p>
          </div>

          <p style="font-size: 14px; color: #666;">You can check your registration status at any time:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${appUrl}/login" style="display: inline-block; background: #4f6df5; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Check Status / Login</a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999;">
          <p>Powered by BAYANAIHAN &middot; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
  });
}

/**
 * Send account approval notification
 */
export async function sendApprovalNotification(
  email: string,
  fullName: string
): Promise<boolean> {
  const appUrl = getAppUrl();

  return sendEmail({
    to: email,
    subject: "eSANGGUNI Account Approved — You Can Now Log In",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2c2c2c;">
        <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #e5e7eb;">
          <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #1a1a2e;">eSANGGUNI</h1>
          <p style="font-size: 12px; color: #666; margin-top: 8px;">Smart Legislation — AI for Local Government</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #16213e;">Welcome, ${escapeHtml(fullName)}!</h2>

          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Your account has been approved.</strong></p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #555;">You now have full access to E.L.L.A. (legal research), O.B.R.A. (ordinance drafting), and Y.A.L.A. (citizen information).</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/login" style="display: inline-block; background: #22c55e; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 15px;">Log In to eSANGGUNI</a>
          </div>

          <p style="font-size: 14px; color: #666;">Your registered email: <strong>${escapeHtml(email)}</strong></p>
        </div>

        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999;">
          <p>Powered by BAYANAIHAN &middot; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
  });
}

/**
 * Send account rejection notification
 */
export async function sendRejectionNotification(
  email: string,
  fullName: string,
  reason?: string
): Promise<boolean> {
  const appUrl = getAppUrl();

  return sendEmail({
    to: email,
    subject: "eSANGGUNI Registration — Update on Your Account",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2c2c2c;">
        <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #e5e7eb;">
          <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #1a1a2e;">eSANGGUNI</h1>
          <p style="font-size: 12px; color: #666; margin-top: 8px;">Smart Legislation — AI for Local Government</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #16213e;">Hello ${escapeHtml(fullName)},</h2>

          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Your registration was not approved.</strong></p>
            ${reason ? `<p style="margin: 8px 0 0; font-size: 14px; color: #555;">Reason: ${escapeHtml(reason)}</p>` : ""}
          </div>

          <p style="font-size: 14px; color: #666;">If you believe this is an error, please contact your LGU administrator. You may also re-register with corrected information.</p>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${appUrl}/register" style="display: inline-block; border: 2px solid #4f6df5; color: #4f6df5; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Re-register</a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999;">
          <p>Powered by BAYANAIHAN &middot; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
  });
}

/**
 * CR-001: Send demo booking notification to admin
 */
export async function sendDemoBookingNotification(booking: {
  fullName: string;
  email: string;
  organization: string;
  position?: string | null;
  phone?: string | null;
  preferredDate?: Date | null;
  preferredSlot?: string | null;
  message?: string | null;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_EMAIL || process.env.SMTP_USER || "sb@pitogo.gov.ph";
  const dateStr = booking.preferredDate
    ? new Date(booking.preferredDate).toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not specified";

  return sendEmail({
    to: adminEmail,
    subject: `eSANGGUNI Demo Request — ${escapeHtml(booking.fullName)} (${escapeHtml(booking.organization)})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2c2c2c;">
        <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #e5e7eb;">
          <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #1a1a2e;">eSANGGUNI</h1>
          <p style="font-size: 12px; color: #666; margin-top: 8px;">New Demo Booking Request</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #16213e;">New Demo Request Received</h2>

          <div style="background: #f0f4ff; border-left: 4px solid #4f6df5; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; font-weight: 600; color: #555; width: 140px;">Name:</td><td style="padding: 6px 0;">${escapeHtml(booking.fullName)}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600; color: #555;">Email:</td><td style="padding: 6px 0;">${escapeHtml(booking.email)}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600; color: #555;">Organization:</td><td style="padding: 6px 0;">${escapeHtml(booking.organization)}</td></tr>
              ${booking.position ? `<tr><td style="padding: 6px 0; font-weight: 600; color: #555;">Position:</td><td style="padding: 6px 0;">${escapeHtml(booking.position)}</td></tr>` : ""}
              ${booking.phone ? `<tr><td style="padding: 6px 0; font-weight: 600; color: #555;">Phone:</td><td style="padding: 6px 0;">${escapeHtml(booking.phone)}</td></tr>` : ""}
              <tr><td style="padding: 6px 0; font-weight: 600; color: #555;">Preferred Date:</td><td style="padding: 6px 0;">${escapeHtml(dateStr)}</td></tr>
              ${booking.preferredSlot ? `<tr><td style="padding: 6px 0; font-weight: 600; color: #555;">Preferred Time:</td><td style="padding: 6px 0;">${escapeHtml(booking.preferredSlot)}</td></tr>` : ""}
            </table>
          </div>

          ${booking.message ? `
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase;">Message:</p>
            <p style="margin: 0; font-size: 14px; color: #333;">${escapeHtml(booking.message)}</p>
          </div>
          ` : ""}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${getAppUrl()}/admin/bookings" style="display: inline-block; background: #4f6df5; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">View in Admin Dashboard</a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999;">
          <p>Powered by BAYANAIHAN &middot; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
  });
}

/**
 * CR-001: Send demo booking confirmation to prospect
 */
export async function sendDemoConfirmation(booking: {
  fullName: string;
  email: string;
  organization: string;
  preferredDate?: Date | null;
  preferredSlot?: string | null;
}): Promise<boolean> {
  const appUrl = getAppUrl();
  const dateStr = booking.preferredDate
    ? new Date(booking.preferredDate).toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return sendEmail({
    to: booking.email,
    subject: "eSANGGUNI Demo Request Received — We'll Be in Touch",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2c2c2c;">
        <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #e5e7eb;">
          <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #1a1a2e;">eSANGGUNI</h1>
          <p style="font-size: 12px; color: #666; margin-top: 8px;">Smart Legislation — AI for Local Government</p>
        </div>

        <div style="padding: 30px 0;">
          <h2 style="color: #16213e;">Hello ${escapeHtml(booking.fullName)},</h2>
          <p>Thank you for requesting a demo of eSANGGUNI! We've received your request and our team will contact you within <strong>1 business day</strong> to confirm your preferred schedule.</p>

          ${dateStr ? `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Your preferred demo schedule:</strong></p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #555;">${escapeHtml(dateStr)}${booking.preferredSlot ? ` at ${escapeHtml(booking.preferredSlot)}` : ""}</p>
          </div>
          ` : `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #166534;"><strong>What happens next?</strong></p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #555;">Our team will reach out to schedule a convenient time for your personalized demo.</p>
          </div>
          `}

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase;">What you'll see in the demo:</p>
            <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>E.L.L.A.</strong> — AI-powered legal research</p>
            <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>O.B.R.A.</strong> — Ordinance drafting assistant</p>
            <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Y.A.L.A.</strong> — Constituent AI assistant</p>
            <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>L.I.K.H.A.</strong> — Archive digitizer</p>
            <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>L.I.N.A.W.</strong> — Ordinance codifier</p>
          </div>
        </div>

        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999;">
          <p>Powered by BAYANAIHAN &middot; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
  });
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// ── Helpers ────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
