/* ======================================================
   GOOGLE APPS SCRIPT WEB APP URL (YOUR URL)
====================================================== */
export const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyd_S2FfENOkyqJnDB5OeKPLfZ0UiEOnBdaxXgf74ACoqkBTQjdILfoFdJX5y7fBbkL/exec";

/* ======================================================
   SEND DATA TO GOOGLE SHEET
====================================================== */
export function sendToSheet(
  name: string,
  email: string,
  qrId: string,
  qrImageUrl: string
) {
  const formData = new URLSearchParams();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("qrId", qrId);
  formData.append("qrImageUrl", qrImageUrl);

  // IMPORTANT: no-cors for Codespaces / Vercel
  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body: formData,
  });

  alert("QR details sent. Email will be sent automatically.");
}
