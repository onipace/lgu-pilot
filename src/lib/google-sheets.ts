// src/lib/google-sheets.ts — CR-001 Demo Booking System
// Google Sheets integration for demo booking records
// Graceful degradation: no-ops when credentials not configured

let sheetsClient: any = null;
let authClient: any = null;

async function getSheetsClient() {
  if (sheetsClient && authClient) return { sheets: sheetsClient, auth: authClient };

  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentialsJson || !sheetId) {
    console.warn("[google-sheets] GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEET_ID not set — Sheets sync disabled");
    return null;
  }

  try {
    const { google } = await import("googleapis");
    const credentials = JSON.parse(credentialsJson);

    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const auth = await authClient.getClient();
    sheetsClient = google.sheets({ version: "v4", auth });

    return { sheets: sheetsClient, auth };
  } catch (err) {
    console.error("[google-sheets] Failed to initialize Google Sheets client:", err);
    return null;
  }
}

interface BookingRow {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  position?: string | null;
  phone?: string | null;
  preferredDate?: Date | null;
  preferredSlot?: string | null;
  message?: string | null;
  createdAt: Date;
}

/**
 * Append a demo booking row to the Google Sheet.
 * Returns { success: true } on success, { success: false, error } on failure.
 * No-ops gracefully when credentials are not configured.
 */
export async function appendBookingRow(booking: BookingRow): Promise<{ success: boolean; error?: string }> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    return { success: true }; // No-op when not configured
  }

  const client = await getSheetsClient();
  if (!client) {
    return { success: false, error: "Failed to initialize Google Sheets client" };
  }

  const { sheets } = client;

  try {
    const values = [[
      booking.createdAt.toISOString(),
      booking.fullName,
      booking.email,
      booking.organization,
      booking.position || "",
      booking.phone || "",
      booking.preferredDate
        ? new Date(booking.preferredDate).toISOString().split("T")[0]
        : "",
      booking.preferredSlot || "",
      booking.message || "",
      booking.id,
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log(`[google-sheets] Booking ${booking.id} appended to sheet ${sheetId}`);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[google-sheets] Failed to append booking ${booking.id}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}
