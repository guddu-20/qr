import React, { useState, useMemo } from "react";
import QRCodeComponent from "react-qr-code";
import QRCode from "qrcode";
import JSZip from "jszip";
import {
  Search,
  Download,
  Trash2,
  Mail,
  X,
  Archive,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Guest } from "../types";

/* ======================================================
   GOOGLE APPS SCRIPT WEB APP URL (YOUR URL)
====================================================== */
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyd_S2FfENOkyqJnDB5OeKPLfZ0UiEOnBdaxXgf74ACoqkBTQjdILfoFdJX5y7fBbkL/exec";

/* ======================================================
   SEND DATA TO GOOGLE SHEET
====================================================== */
function sendToSheet(
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

/* ======================================================
   PROPS
====================================================== */
interface RegistryProps {
  guests: Guest[];
  onDeleteGuest: (id: string) => void;
}

/* ======================================================
   COMPONENT
====================================================== */
const Registry: React.FC<RegistryProps> = ({ guests, onDeleteGuest }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  /* ================= UNIQUE GUESTS ================= */
  const uniqueGuests = useMemo(() => {
    const seen = new Set<string>();
    return guests.filter(guest => {
      if (seen.has(guest.email)) return false;
      seen.add(guest.email);
      return true;
    });
  }, [guests]);

  /* ================= SEARCH ================= */
  const filteredGuests = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return uniqueGuests.filter(
      (g) =>
        g.name.toLowerCase().includes(lower) ||
        g.email.toLowerCase().includes(lower) ||
        String(g.id).includes(lower)
    );
  }, [uniqueGuests, searchTerm]);

  /* ================= SINGLE QR DOWNLOAD ================= */
  const downloadQR = (id: string, name: string) => {
    const svg = document.getElementById(`qr-${id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const png = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.download = `EventPass-${name}-${id}.png`;
      link.href = png;
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  /* ================= BULK ZIP DOWNLOAD ================= */
  const handleBulkDownload = async () => {
    if (uniqueGuests.length === 0) return;
    if (!window.confirm(`Download QR codes for ${uniqueGuests.length} guests?`))
      return;

    setIsZipping(true);
    setZipProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder("Event_QRCodes");

      let processed = 0;
      for (const guest of uniqueGuests) {
        const dataUrl = await QRCode.toDataURL(String(guest.id), {
          width: 400,
          margin: 2,
        });
        const base64 = dataUrl.split(",")[1];
        const safeName = guest.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        folder?.file(`${safeName}_${guest.id}.png`, base64, { base64: true });

        processed++;
        setZipProgress(processed);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "All_Event_QRs.zip";
      link.click();
    } catch (err) {
      console.error(err);
      alert("Failed to generate ZIP");
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  /* ================= EMAIL BUTTON ================= */
  const handleSendEmail = (guest: Guest) => {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${guest.id}&size=200x200`;

    sendToSheet(
      guest.name,
      guest.email,
      guest.id,
      qrImageUrl
    );
  };

  /* ================= SEND EMAILS TO ALL ================= */
  const handleSendEmailsToAll = async () => {
    if (uniqueGuests.length === 0) return;
    if (!window.confirm(`Send emails to ${uniqueGuests.length} guests?`)) return;

    setIsSendingEmails(true);

    try {
      for (const guest of uniqueGuests) {
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${guest.id}&size=200x200`;
        sendToSheet(guest.name, guest.email, guest.id, qrImageUrl);
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      alert("Emails sent to all guests.");
    } catch (err) {
      console.error(err);
      alert("Failed to send emails.");
    } finally {
      setIsSendingEmails(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="flex h-full relative">
      {/* LEFT PANEL */}
      <div
        className={`flex-1 border-r flex flex-col ${
          selectedGuest ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold mb-3">
            Registry ({uniqueGuests.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredGuests.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              No guests found
            </div>
          ) : (
            filteredGuests.map((guest) => (
              <div
                key={guest.id}
                onClick={() => setSelectedGuest(guest)}
                className="p-4 border-b cursor-pointer hover:bg-slate-50"
              >
                <p className="font-semibold">{guest.name}</p>
                <p className="text-xs text-slate-500">{guest.email}</p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={handleBulkDownload}
            disabled={isZipping}
            className="w-full bg-black text-white p-3 rounded flex items-center justify-center gap-2"
          >
            {isZipping ? (
              <>
                <Loader2 className="animate-spin" />
                {Math.round((zipProgress / guests.length) * 100)}%
              </>
            ) : (
              <>
                <Archive /> Download All
              </>
            )}
          </button>

          <button
            onClick={handleSendEmailsToAll}
            disabled={isSendingEmails}
            className="w-full bg-blue-600 text-white p-3 rounded flex items-center justify-center gap-2"
          >
            {isSendingEmails ? (
              <>
                <Loader2 className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail /> Send Mails to All
              </>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      {selectedGuest && (
        <div className="w-full md:w-[400px] bg-slate-50 p-6 absolute md:static inset-0">
          <button
            className="md:hidden mb-3 flex items-center gap-1"
            onClick={() => setSelectedGuest(null)}
          >
            <ArrowLeft /> Back
          </button>

          <div className="bg-white p-6 rounded shadow text-center">
            <QRCodeComponent
              value={String(selectedGuest.id)}
              id={`qr-${selectedGuest.id}`}
              size={200}
            />

            <h3 className="mt-4 font-bold">{selectedGuest.name}</h3>
            <p className="text-sm text-slate-500">{selectedGuest.email}</p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() =>
                  downloadQR(selectedGuest.id, selectedGuest.name)
                }
                className="w-full bg-black text-white p-3 rounded flex justify-center gap-2"
              >
                <Download /> Download QR
              </button>

              <button
                onClick={() => handleSendEmail(selectedGuest)}
                className="w-full bg-blue-600 text-white p-3 rounded flex justify-center gap-2"
              >
                <Mail /> Email
              </button>

              <button
                onClick={() => {
                  if (window.confirm("Delete this guest?")) {
                    onDeleteGuest(selectedGuest.id);
                    setSelectedGuest(null);
                  }
                }}
                className="w-full bg-red-100 text-red-600 p-3 rounded flex justify-center gap-2"
              >
                <Trash2 /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registry;
