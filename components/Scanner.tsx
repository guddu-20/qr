import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Guest, ScanLog } from '../types';
import { ScanLine, Keyboard, AlertCircle, CheckCircle2, AlertTriangle, Camera } from 'lucide-react';

interface ScannerProps {
  guests: Guest[];
  onScan: (guestId: string, day: 1 | 2) => { success: boolean; message: string; guest?: Guest };
}

const Scanner: React.FC<ScannerProps> = ({ guests, onScan }) => {
  const [activeDay, setActiveDay] = useState<1 | 2>(1);
  const [lastResult, setLastResult] = useState<{ status: 'idle' | 'success' | 'error' | 'duplicate'; message: string; guestName?: string }>({
    status: 'idle',
    message: 'Ready to scan',
  });
  const [manualId, setManualId] = useState('');
  const [scannerReady, setScannerReady] = useState(false);

  // Using a ref to prevent double initialization in Strict Mode
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Audio refs
  const successAudio = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const errorAudio = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/950/950-preview.mp3'));

  const handleScanResult = useCallback((decodedText: string) => {
    // Prevent rapid fire scanning of same code
    if (scannerRef.current) {
        try {
            // Attempt to pause scanner to prevent multiple scans while processing
            scannerRef.current.pause(true); 
        } catch (err) {
            console.warn("Scanner pause failed (likely already paused or stopped):", err);
        }
    }

    const result = onScan(decodedText, activeDay);

    if (result.success) {
      setLastResult({ status: 'success', message: result.message, guestName: result.guest?.name });
      successAudio.current.play().catch(() => {});
    } else {
      const isDuplicate = result.message.includes('Already');
      setLastResult({ 
        status: isDuplicate ? 'duplicate' : 'error', 
        message: result.message,
        guestName: result.guest?.name
      });
      errorAudio.current.play().catch(() => {});
    }

    // Resume scanning after delay
    setTimeout(() => {
        if(scannerRef.current) {
            try {
                scannerRef.current.resume();
            } catch (err) {
                console.warn("Scanner resume failed:", err);
            }
        }
        setLastResult(prev => prev.status === 'idle' ? prev : { status: 'idle', message: 'Ready to scan' });
    }, 2500);
  }, [activeDay, onScan]);

  useEffect(() => {
    // Only initialize if the element exists and we haven't already
    const element = document.getElementById('reader');
    if (element && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        },
        false
      );

      scanner.render(handleScanResult, (err) => {
        // console.warn(err); // Ignore frame errors
      });
      
      scannerRef.current = scanner;
      setScannerReady(true);
    }

    return () => {
      if (scannerRef.current) {
        try {
            scannerRef.current.clear().catch(console.error);
        } catch (e) {
            console.warn("Failed to clear scanner on unmount", e);
        }
        scannerRef.current = null;
      }
    };
  }, [handleScanResult]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      handleScanResult(manualId.trim());
      setManualId('');
    }
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col items-center overflow-y-auto w-full">
      <div className="text-center mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Scanning Station</h2>
        <p className="text-slate-500 text-sm md:text-base">Monitoring entrance for Day {activeDay}</p>
      </div>

      {/* Main Scanner Container */}
      <div className="relative w-full max-w-lg">
        {/* Status Overlay */}
        <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 z-20 px-6 py-2 rounded-full shadow-lg font-bold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${
            lastResult.status === 'idle' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        } ${
            lastResult.status === 'success' ? 'bg-green-500 text-white' : 
            lastResult.status === 'duplicate' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
        }`}>
            {lastResult.status === 'success' && <div className="flex items-center gap-2"><CheckCircle2 size={16}/> ACCESS GRANTED</div>}
            {lastResult.status === 'duplicate' && <div className="flex items-center gap-2"><AlertTriangle size={16}/> DUPLICATE ENTRY</div>}
            {lastResult.status === 'error' && <div className="flex items-center gap-2"><AlertCircle size={16}/> {lastResult.message.toUpperCase()}</div>}
        </div>

        {/* Guest Name Popover */}
        {lastResult.guestName && lastResult.status !== 'idle' && (
             <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-20 bg-white px-4 py-2 rounded-lg shadow-xl text-slate-900 font-bold border border-slate-200 whitespace-nowrap">
                {lastResult.guestName}
             </div>
        )}

        <div className="bg-white p-3 md:p-4 rounded-3xl shadow-xl border-4 border-slate-200 relative overflow-hidden">
           {/* Day Indicator Badge */}
           <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-white shadow-sm ${
               activeDay === 1 ? 'bg-blue-500' : 'bg-purple-500'
           }`}>
               Day {activeDay} Active
           </div>
           
           <div id="reader" className="rounded-xl overflow-hidden min-h-[300px] bg-slate-100"></div>

           {/* Permission Placeholder (Visual only, library handles actual UI usually but this covers empty state) */}
           {!scannerReady && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 rounded-xl">
                   <Camera size={48} className="text-slate-300 mb-4" />
                   <p className="text-slate-400 font-medium">Initializing Camera...</p>
               </div>
           )}
        </div>
      </div>

      {/* Manual Entry */}
      <div className="mt-8 w-full max-w-md">
        <form onSubmit={handleManualSubmit} className="bg-slate-200 p-2 rounded-xl flex gap-2">
            <div className="flex-1 relative">
                <Keyboard className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                    type="text" 
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="Enter ID" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border-none focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono text-slate-700 text-sm"
                />
            </div>
            <button type="submit" className="bg-slate-700 text-white px-4 md:px-6 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                Enter
            </button>
        </form>
      </div>

      {/* Day Toggles */}
      <div className="mt-8 flex gap-4">
        <button 
            onClick={() => setActiveDay(1)}
            className={`px-6 md:px-8 py-3 rounded-xl font-bold transition-all duration-200 border-2 ${
                activeDay === 1 
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' 
                : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200'
            }`}
        >
            Day 1
        </button>
        <button 
            onClick={() => setActiveDay(2)}
            className={`px-6 md:px-8 py-3 rounded-xl font-bold transition-all duration-200 border-2 ${
                activeDay === 2 
                ? 'bg-purple-600 border-purple-600 text-white shadow-lg scale-105' 
                : 'bg-white border-slate-200 text-slate-400 hover:border-purple-200'
            }`}
        >
            Day 2
        </button>
      </div>
      
      <div className="mt-4 inline-flex items-center gap-2 px-4 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider">
          <ScanLine size={14} /> Auto-Sanitization
      </div>

    </div>
  );
};

export default Scanner;