import React, { useState } from 'react';
import { Upload, FileUp, AlertOctagon, UserPlus, Table, RefreshCw, HelpCircle, Check, XCircle, Download, Radio, Smartphone, Monitor, Mail } from 'lucide-react';
import { Guest, ScanLog, SyncMode } from '../types';
import QRCode from 'qrcode';
import JSZip from 'jszip';

interface SetupProps {
  onAddGuest: (guest: Guest) => void;
  onBulkImport: (guests: Guest[]) => void;
  onResetSystem: () => void;
  onMergeLogs: (logs: ScanLog[]) => void;
  totalGuests: number;
  scanLogs: ScanLog[];
  // Live Sync Props
  syncMode: SyncMode;
  sessionId: string;
  connectedPeers: number;
  onStartHosting: () => void;
  onJoinSession: (code: string) => void;
}

const Setup: React.FC<SetupProps> = ({
  onAddGuest,
  onBulkImport,
  onResetSystem,
  onMergeLogs,
  totalGuests,
  scanLogs,
  guests,
  syncMode,
  sessionId,
  connectedPeers,
  onStartHosting,
  onJoinSession
}) => {
  const [formData, setFormData] = useState({ registrationNumber: '', name: '', gitamMailId: '', mobileNumber: '' });

  const [manualRegData, setManualRegData] = useState({ registrationNumber: '', fullName: '', mobileNumber: '', gitamMailId: '' });
  
  // Sync State
  const [joinCode, setJoinCode] = useState('');

  // Google Sheets State
  const [sheetInput, setSheetInput] = useState('');
  const [sheetTab, setSheetTab] = useState('Sheet1');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  
  // CSV Import Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newGuests: Guest[] = [];
      
      lines.forEach((line, index) => {
        if (!line.trim()) return;
        const parts = line.split(',');
        // Basic heuristic to skip header row if "name" or "email" is in it
        if (index === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('email'))) return;

        if (parts.length >= 2) {
            const name = parts[0]?.trim();
            const email = parts[1]?.trim();
            const id = parts[2]?.trim() || Math.random().toString(36).substr(2, 9).toUpperCase();
            const category = parts[3]?.trim() || 'General';
            
            if(name && email) {
                newGuests.push({
                    id,
                    name,
                    email,
                    category,
                    checkInDay1: null,
                    checkInDay2: null
                });
            }
        }
      });

      if (newGuests.length > 0) {
        onBulkImport(newGuests);
        setSyncStatus({ type: 'success', message: `Imported ${newGuests.length} guests from CSV.` });
      } else {
        setSyncStatus({ type: 'error', message: 'Failed to parse CSV. Format: Name,Email,ID,Category' });
      }
    };
    reader.readAsText(file);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.registrationNumber && formData.name && formData.gitamMailId) {
      const newGuest: Guest = {
        id: formData.registrationNumber,
        name: formData.name,
        email: formData.gitamMailId,
        phone: formData.mobileNumber,
        category: 'General',
        checkInDay1: null,
        checkInDay2: null
      };
      onAddGuest(newGuest);
      setFormData({ registrationNumber: '', name: '', gitamMailId: '', mobileNumber: '' });
      alert(`Added ${newGuest.name}`);
    }
  };

  const handleManualRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualRegData.registrationNumber && manualRegData.fullName && manualRegData.mobileNumber && manualRegData.gitamMailId) {
      const newGuest: Guest = {
        id: manualRegData.registrationNumber,
        name: manualRegData.fullName,
        email: manualRegData.gitamMailId,
        phone: manualRegData.mobileNumber,
        category: 'General',
        checkInDay1: null,
        checkInDay2: null
      };
      onAddGuest(newGuest);
      setManualRegData({ registrationNumber: '', fullName: '', mobileNumber: '', gitamMailId: '' });
      alert(`Added ${newGuest.name}`);
    }
  };

  const generateGuestEmail = async (guest: Guest) => {
    const qrText = `Name: ${guest.name}\nEmail: ${guest.email || 'Not provided'}\nCategory: ${guest.category}\nID: ${guest.id}`;
    const qrDataURL = await QRCode.toDataURL(qrText, { width: 256 });
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Invitation - ${guest.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .qr-code { text-align: center; margin: 20px 0; }
        .qr-code img { max-width: 100%; height: auto; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Event Invitation</h1>
        <p>Dear ${guest.name},</p>
        <p>You are invited to our event. Please present this QR code at check-in.</p>
        <div class="qr-code">
            <img src="${qrDataURL}" alt="QR Code for ${guest.id}" />
        </div>
        <p>Your Ticket ID: <strong>${guest.id}</strong></p>
        <p>Category: ${guest.category}</p>
        <div class="footer">
            <p>This email contains your personal QR code. Do not share it.</p>
        </div>
    </div>
</body>
</html>`;
    return html;
  };

  const handleGenerateEmails = async () => {
    if (guests.length === 0) {
      alert('No guests to generate emails for.');
      return;
    }
    const zip = new JSZip();
    for (const guest of guests) {
      const html = await generateGuestEmail(guest);
      const filename = `${guest.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_${guest.id}.html`;
      zip.file(filename, html);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Guest_Emails_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const extractSheetId = (input: string) => {
    // Handle full URL: https://docs.google.com/spreadsheets/d/1BxiMVs.../edit
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input.trim();
  };

  const handleSheetSync = async () => {
    setSyncStatus({ type: 'idle', message: 'Connecting to Google Sheets...' });
    const sheetId = extractSheetId(sheetInput);

    if (!sheetId) {
      setSyncStatus({ type: 'error', message: 'Please enter a valid Spreadsheet ID or URL.' });
      return;
    }

    setIsSyncing(true);
    try {
      // Integrated API Key
      const apiKey = "AIzaSyDFagrIB_lwXF4q4tG2pAWAurBztSgLxDU";
      
      // ---------------------------------------------------------
      // Step 1: Auto-detect Sheet Name (Metadata Fetch)
      // ---------------------------------------------------------
      let targetTabName = sheetTab.trim();
      
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title&key=${apiKey}`;
      const metaResponse = await fetch(metaUrl);
      
      if (metaResponse.ok) {
        const metaData = await metaResponse.json();
        const sheets = metaData.sheets;
        
        if (sheets && sheets.length > 0) {
            const match = sheets.find((s: any) => s.properties.title.toLowerCase() === targetTabName.toLowerCase());
            
            if (match) {
                targetTabName = match.properties.title;
            } else {
                targetTabName = sheets[0].properties.title;
                setSheetTab(targetTabName);
            }
        }
      }

      // ---------------------------------------------------------
      // Step 2: Fetch Values
      // ---------------------------------------------------------
      
      const formattedTab = targetTabName.includes(' ') && !targetTabName.startsWith("'") 
        ? `'${targetTabName}'` 
        : targetTabName;

      const range = `${formattedTab}!A1:E20000`; 
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to fetch from Google Sheets');
      }

      const data = await response.json();
      const rows = data.values;

      if (!rows || rows.length === 0) {
        throw new Error('Connected, but the sheet is empty.');
      }

      // Parse Headers (Simple Heuristic to find columns)
      const headers = rows[0].map((h: string) => h.toLowerCase());
      const nameIdx = headers.findIndex((h: string) => h.includes('name'));
      const emailIdx = headers.findIndex((h: string) => h.includes('email'));
      const idIdx = headers.findIndex((h: string) => h.includes('id') || h.includes('ticket'));
      const catIdx = headers.findIndex((h: string) => h.includes('category') || h.includes('type'));
      
      const startIndex = (nameIdx !== -1 || emailIdx !== -1) ? 1 : 0;
      
      const newGuests: Guest[] = [];

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0) continue;

        const name = nameIdx !== -1 ? row[nameIdx] : row[0];
        const email = emailIdx !== -1 ? row[emailIdx] : row[1];
        
        if (name && email) {
            newGuests.push({
                id: (idIdx !== -1 ? row[idIdx] : row[2]) || Math.random().toString(36).substr(2, 9).toUpperCase(),
                name: name.trim(),
                email: email.trim(),
                category: (catIdx !== -1 ? row[catIdx] : row[3]) || 'General',
                checkInDay1: null,
                checkInDay2: null
            });
        }
      }

      if (newGuests.length > 0) {
        onBulkImport(newGuests);
        setSyncStatus({ type: 'success', message: `Success! Synced ${newGuests.length} guests from "${targetTabName}".` });
        setSheetInput('');
      } else {
        throw new Error('Could not parse guest data. Ensure columns are: Name, Email.');
      }

    } catch (error: any) {
      setSyncStatus({ type: 'error', message: error.message });
    } finally {
      setIsSyncing(false);
    }
  };


  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto overflow-y-auto h-full">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">System Setup</h2>
        <p className="text-slate-500 text-sm md:text-base">Configure guests and synchronize data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Live Synchronization */}
        <div className={`p-6 md:p-8 rounded-2xl shadow-sm border flex flex-col transition-colors ${syncMode !== 'ALONE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-2 mb-4">
             <Radio className={syncMode !== 'ALONE' ? 'text-white' : 'text-indigo-600'} size={24} />
             <h3 className={`font-bold text-lg ${syncMode !== 'ALONE' ? 'text-white' : 'text-slate-900'}`}>Live Sync (Beta)</h3>
          </div>
          
          {syncMode === 'ALONE' ? (
              <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-500">Connect multiple devices to sync scans in real-time. Requires internet.</p>
                  
                  <button 
                    onClick={onStartHosting}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                      <Monitor size={18} /> Host Session
                  </button>
                  
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Session Code" 
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, ''))}
                        className="flex-1 px-4 py-3 rounded-lg border border-slate-200 outline-none text-slate-900 text-center font-mono font-bold tracking-widest placeholder:tracking-normal placeholder:font-sans"
                        maxLength={6}
                      />
                      <button 
                        onClick={() => onJoinSession(joinCode)}
                        disabled={joinCode.length < 6}
                        className="px-6 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition-colors disabled:opacity-50"
                      >
                          Join
                      </button>
                  </div>
              </div>
          ) : (
              <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-6 bg-white/10 p-2 rounded-lg">
                      {syncMode === 'HOST' ? <Monitor size={20} /> : <Smartphone size={20} />}
                      <span className="font-bold text-sm tracking-wide">{syncMode === 'HOST' ? 'HOSTING SESSION' : 'CONNECTED AS CLIENT'}</span>
                  </div>

                  <div className="text-center mb-6">
                      <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Session Code</p>
                      <p className="text-4xl font-mono font-bold">{sessionId}</p>
                  </div>

                  <div className="mt-auto bg-white/10 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-sm font-medium">Connected Devices</span>
                      <span className="text-xl font-bold">{connectedPeers}</span>
                  </div>
                  
                  <p className="text-xs text-indigo-200 mt-4 text-center">
                    Data is syncing automatically. Do not close this tab.
                  </p>
              </div>
          )}
        </div>

        {/* Bulk Import */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="font-bold text-lg text-slate-900 mb-6 self-start">Bulk Import</h3>
          
          <label className="w-full aspect-square max-h-[250px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all group">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                <FileUp size={32} />
            </div>
            <p className="font-medium text-slate-900">Click to upload CSV</p>
            <p className="text-xs text-slate-400 mt-2 px-8">
              Exports from Google Sheets.
            </p>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>


        {/* System Health */}
        <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <AlertOctagon className="text-blue-400" />
                <h3 className="font-bold text-lg">System Health</h3>
            </div>
            
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                <span className="block mb-2">Guests Loaded: <span className="text-white font-bold">{totalGuests}</span></span>
                <span className="block">Scans Recorded: <span className="text-white font-bold">{scanLogs.length}</span></span>
            </p>

            <div className="mt-auto">
                <button 
                    onClick={() => {
                        if(window.confirm("ARE YOU SURE? This will wipe all guest data.")) {
                            onResetSystem();
                            alert("System reset complete. All data has been wiped.");
                        }
                    }}
                    className="w-full border border-red-500/50 bg-red-500/10 text-red-500 py-3 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                    <AlertOctagon size={18} /> Factory Reset System
                </button>
            </div>
        </div>

      </div>

      {/* Google Sheets Integration */}
      <div className="mt-8 bg-white p-6 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
             <Table size={20} />
           </div>
           <div>
             <h4 className="font-bold text-slate-900">Google Sheets Sync</h4>
             <p className="text-xs text-slate-500">Directly import from your master spreadsheet</p>
           </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Spreadsheet ID or URL</label>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="https://docs.google.com/spreadsheets/d/..." 
                        value={sheetInput}
                        onChange={(e) => setSheetInput(e.target.value)}
                        className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-mono !bg-white !text-black placeholder:text-slate-400"
                    />
                </div>
             </div>
             <div className="w-full md:w-48">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Tab Name (Optional)</label>
                <input 
                    type="text" 
                    placeholder="e.g. Sheet1" 
                    value={sheetTab}
                    onChange={(e) => setSheetTab(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm !bg-white !text-black placeholder:text-slate-400"
                />
             </div>
             <button 
                onClick={handleSheetSync}
                disabled={isSyncing}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full md:w-auto"
             >
                {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <FileUp size={18} />}
                {isSyncing ? 'Syncing...' : 'Sync Now'}
             </button>
        </div>
        
        {/* Status Messages */}
        {syncStatus.type !== 'idle' && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                syncStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
                {syncStatus.type === 'success' ? <Check size={18} /> : <XCircle size={18} />}
                <span className="font-medium">{syncStatus.message}</span>
            </div>
        )}

      </div>

      {/* Generate Guest Emails */}
      <div className="mt-8 bg-white p-6 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <Mail size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900">Generate Guest Emails</h4>
            <p className="text-xs text-slate-500">Create personalized HTML emails with embedded QR codes</p>
          </div>
        </div>
        <button
          onClick={handleGenerateEmails}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={18} /> Download Emails as ZIP
        </button>
      </div>

      {/* Manual Registrations */}
      <div className="mt-8 bg-white p-6 rounded-xl border border-slate-100">
        <h4 className="font-bold text-slate-900 mb-4">Manual Registrations</h4>
        <form onSubmit={handleManualRegistration} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Registration Number</label>
              <input
                type="text"
                value={manualRegData.registrationNumber}
                onChange={(e) => setManualRegData({...manualRegData, registrationNumber: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name</label>
              <input
                type="text"
                value={manualRegData.fullName}
                onChange={(e) => setManualRegData({...manualRegData, fullName: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Mobile Number</label>
              <input
                type="tel"
                value={manualRegData.mobileNumber}
                onChange={(e) => setManualRegData({...manualRegData, mobileNumber: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Gitam Mail ID</label>
              <input
                type="email"
                value={manualRegData.gitamMailId}
                onChange={(e) => setManualRegData({...manualRegData, gitamMailId: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};

export default Setup;