import React, { useState, useMemo } from 'react';
import QRCodeComponent from 'react-qr-code'; // Component for display
import QRCode from 'qrcode'; // Library for generation
import JSZip from 'jszip';
import { Search, Download, Trash2, Mail, X, Archive, Loader2, ArrowLeft } from 'lucide-react';
import { Guest } from '../types';

interface RegistryProps {
  guests: Guest[];
  onDeleteGuest: (id: string) => void;
}

const Registry: React.FC<RegistryProps> = ({ guests, onDeleteGuest }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const filteredGuests = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(lowerTerm) || 
      String(g.id).toLowerCase().includes(lowerTerm) ||
      g.email.toLowerCase().includes(lowerTerm)
    );
  }, [guests, searchTerm]);

  // Single QR Download
  const downloadQR = (id: string, name: string) => {
    const svg = document.getElementById(`qr-${id}`);
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `EventGuard-${name}-${id}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    }
  };

  // Bulk ZIP Download
  const handleBulkDownload = async () => {
    if (guests.length === 0) return;
    if (!window.confirm(`Generate and download QR codes for all ${guests.length} guests? This operation might take some time for large lists.`)) return;

    setIsZipping(true);
    setZipProgress(0);
    
    try {
        const ZipClass: any = JSZip;
        const zip = new (ZipClass.default || ZipClass)();
        
        const folder = zip.folder("EventGuard_QRCodes");
        const QRLib: any = QRCode; 

        const toDataURL = QRLib.toDataURL || (QRLib.default && QRLib.default.toDataURL);
        
        if (!toDataURL) {
            throw new Error("QR Code library failed to load properly. Please refresh and try again.");
        }

        let processed = 0;
        const chunkSize = 50;
        for (let i = 0; i < guests.length; i += chunkSize) {
            const chunk = guests.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (guest) => {
                 try {
                     const dataUrl = await toDataURL(guest.id, { width: 400, margin: 2 });
                     const base64Data = dataUrl.split(',')[1];
                     const safeName = guest.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                     folder?.file(`${safeName}_${guest.id}.png`, base64Data, { base64: true });
                 } catch (e) {
                     console.warn(`Failed to generate QR for ${guest.name}`, e);
                 }
            }));

            processed += chunk.length;
            setZipProgress(Math.min(processed, guests.length));
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `EventGuard_All_Passes_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      
    } catch (err: any) {
      console.error(err);
      alert(`Failed to generate ZIP file: ${err.message || err}`);
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  const handleSendEmail = (guest: Guest) => {
    const subject = encodeURIComponent(`Your Event Pass: ${guest.name}`);
    const body = encodeURIComponent(
`Dear ${guest.name},

We are excited to welcome you to the event!

Your Registration Details:
Name: ${guest.name}
Registration Number: ${guest.id}
Category: ${guest.category}

Please present your Registration Number or QR Code at the entrance.

Sent from: EventGuard System (smdaasim2@gmail.com)`
    );

    window.location.href = `mailto:${guest.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex h-full relative">
      {/* Left List Pane: On mobile, hide this pane when a guest is selected */}
      <div className={`flex-1 flex flex-col h-full border-r border-slate-200 bg-white ${selectedGuest ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start gap-4">
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4">Registry ({guests.length})</h2>
            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                />
            </div>
          </div>
          <button
            onClick={handleBulkDownload}
            disabled={isZipping || guests.length === 0}
            className="mt-1 bg-slate-900 text-white p-3 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex flex-col items-center justify-center gap-1 w-20 md:w-24 flex-shrink-0"
            title="Download all QR Codes as ZIP"
          >
            {isZipping ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-[9px] font-bold">{Math.round((zipProgress / guests.length) * 100)}%</span>
                </>
            ) : (
                <>
                    <Archive size={20} />
                    <span className="text-[9px] font-bold uppercase text-center leading-tight">Download All</span>
                </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredGuests.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              {searchTerm ? 'No guests found matching search.' : 'Registry is empty.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredGuests.map(guest => (
                <div 
                  key={guest.id} 
                  onClick={() => setSelectedGuest(guest)}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${selectedGuest?.id === guest.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                >
                  <div className="overflow-hidden">
                    <p className="font-semibold text-slate-900 truncate pr-2">{guest.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">ID: {guest.id}</p>
                  </div>
                  <div className="flex gap-2 text-xs flex-shrink-0">
                    <span className={`px-2 py-1 rounded ${guest.checkInDay1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>D1</span>
                    <span className={`px-2 py-1 rounded ${guest.checkInDay2 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>D2</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Details Pane: On mobile, this becomes full screen if selectedGuest is present */}
      <div className={`
         bg-slate-50 h-full flex flex-col items-center justify-center border-l border-slate-200 transition-all duration-300
         ${selectedGuest ? 'flex w-full absolute inset-0 md:static md:w-[400px] z-20' : 'hidden md:flex md:w-[400px]'}
      `}>
        {selectedGuest ? (
          <div className="w-full h-full md:h-auto overflow-y-auto p-4 md:p-8 flex flex-col">
            {/* Mobile Header for Details View */}
            <div className="flex justify-between items-center mb-4 md:absolute md:top-4 md:right-4 w-full md:w-auto">
                <button 
                    onClick={() => setSelectedGuest(null)} 
                    className="md:hidden flex items-center gap-1 text-slate-500 hover:text-slate-800"
                >
                    <ArrowLeft size={20} /> Back
                </button>
                <button 
                    onClick={() => setSelectedGuest(null)} 
                    className="hidden md:block text-slate-400 hover:text-slate-600"
                >
                    <X />
                </button>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-200 flex flex-col items-center text-center m-auto md:m-0 w-full max-w-sm md:max-w-none">
              <div className="bg-white p-2 rounded-xl border-2 border-slate-100 mb-6 w-full max-w-[200px]">
                <div style={{ height: "auto", margin: "0 auto", width: "100%" }}>
                    <QRCodeComponent
                        size={256}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        value={String(selectedGuest.id)}
                        viewBox={`0 0 256 256`}
                        id={`qr-${selectedGuest.id}`}
                    />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 break-words w-full">{selectedGuest.name}</h3>
              <span className="inline-block mt-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wide">
                {selectedGuest.category}
              </span>
              
              <div className="mt-4 space-y-1 w-full overflow-hidden">
                <p className="text-sm text-slate-500 flex items-center justify-center gap-2 truncate">
                   <span className="font-mono text-slate-400">Reg #:</span> {selectedGuest.id}
                </p>
                <p className="text-sm text-blue-500 hover:underline cursor-pointer truncate">
                    {selectedGuest.email}
                </p>
                {selectedGuest.phone && (
                   <p className="text-sm text-slate-400">
                    {selectedGuest.phone}
                   </p>
                )}
              </div>

              <div className="mt-8 w-full space-y-3">
                <button 
                  onClick={() => downloadQR(selectedGuest.id, selectedGuest.name)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-colors"
                >
                    <Download size={16} /> Download
                </button>
                <button 
                  onClick={() => handleSendEmail(selectedGuest)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                    <Mail size={16} /> Email
                </button>
                <button 
                  onClick={() => {
                      if(window.confirm(`Are you sure you want to permanently delete ${selectedGuest.name}? This cannot be undone.`)) {
                          onDeleteGuest(selectedGuest.id);
                          setSelectedGuest(null);
                      }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors"
                >
                    <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
            <div className="text-center text-slate-400">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>Select a guest</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Registry;