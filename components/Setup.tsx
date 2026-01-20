import React, { useState } from 'react';
import { Upload, FileUp, AlertOctagon, UserPlus, Table, RefreshCw, HelpCircle, Check, XCircle, Download, Share2, Radio, Smartphone, Monitor } from 'lucide-react';
import { Guest, ScanLog, SyncMode } from '../types';

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
  syncMode,
  sessionId,
  connectedPeers,
  onStartHosting,
  onJoinSession
}) => {
  const [formData, setFormData] = useState({ name: '', email: '', category: 'General', id: '', phone: '' });
  
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
    if (formData.name && formData.email) {
      const newGuest: Guest = {
        id: formData.id || Math.random().toString(36).substr(2, 9).toUpperCase(),
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        category: formData.category,
        checkInDay1: null,
        checkInDay2: null
      };
      onAddGuest(newGuest);
      setFormData({ name: '', email: '', category: 'General', id: '', phone: '' });
      alert(`Added ${newGuest.name}`);
    }
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

  // --- Sync Handlers ---

  const handleExportSync = () => {
    const dataStr = JSON.stringify(scanLogs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EventGuard_SyncData_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const json = JSON.parse(evt.target?.result as string);
            if (Array.isArray(json)) {
                onMergeLogs(json);
                alert("Data merged successfully! Dashboard updated.");
            } else {
                alert("Invalid Sync File format.");
            }
        } catch (err) {
            alert("Failed to parse Sync File.");
        }
    };
    reader.readAsText(file);
    // Reset value to allow re-uploading same file if needed
    e.target.value = '';
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

        {/* Manual Sync (Backup) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
             <Share2 className="text-slate-500" />
             <h3 className="font-bold text-lg text-slate-900">Manual Backup</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            If Live Sync is unavailable due to network issues, use file export/import.
          </p>
          
          <div className="space-y-4 mt-auto">
             <button 
                onClick={handleExportSync}
                className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-100 transition-colors"
             >
                <Download size={18} /> Export File
             </button>
             
             <label className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition-colors cursor-pointer">
                <Upload size={18} /> Import File
                <input type="file" accept=".json" className="hidden" onChange={handleImportSync} />
             </label>
          </div>
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
    </div>
  );
};

export default Setup;