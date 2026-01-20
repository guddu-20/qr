import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import Registry from './components/Registry';
import Setup from './components/Setup';
import { Guest, ScanLog, ViewState, SyncMode, SyncMessage } from './types';

const STORAGE_KEY_GUESTS = 'eventguard_guests_v1';
const STORAGE_KEY_LOGS = 'eventguard_logs_v1';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  // Sync State
  const [syncMode, setSyncMode] = useState<SyncMode>('ALONE');
  const [sessionId, setSessionId] = useState('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  // Use a ref for guests/logs to access latest state inside Peer callbacks
  const stateRef = useRef({ guests, scanLogs });

  useEffect(() => {
    stateRef.current = { guests, scanLogs };
  }, [guests, scanLogs]);

  // Initialize from LocalStorage
  useEffect(() => {
    const storedGuests = localStorage.getItem(STORAGE_KEY_GUESTS);
    const storedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    if (storedGuests) setGuests(JSON.parse(storedGuests));
    if (storedLogs) setScanLogs(JSON.parse(storedLogs));
  }, []);

  // Persist Updates
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GUESTS, JSON.stringify(guests));
  }, [guests]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(scanLogs));
  }, [scanLogs]);

  // --- Sync Logic ---

  const handleStartHosting = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Using a namespace prefix to avoid collisions on the public PeerJS cloud
    const newPeer = new Peer(`eventguard-${code}`);
    
    newPeer.on('open', (id) => {
        setSessionId(code);
        setSyncMode('HOST');
    });

    newPeer.on('connection', (conn) => {
        // Send Initial State to new client
        conn.on('open', () => {
             console.log('Client connected, sending init state');
             setConnections(prev => [...prev, conn]);
             conn.send({ 
                 type: 'INIT', 
                 payload: { 
                     guests: stateRef.current.guests, 
                     scanLogs: stateRef.current.scanLogs 
                 } 
             });
        });

        conn.on('data', (data: any) => handleSyncMessage(data, conn.peer));
        
        conn.on('close', () => {
            setConnections(prev => prev.filter(c => c.peer !== conn.peer));
        });
    });

    newPeer.on('error', (err) => {
        console.error('Peer Error:', err);
        alert('Sync Error: ' + err.type);
    });

    setPeer(newPeer);
  };

  const handleJoinSession = (code: string) => {
    const newPeer = new Peer(); // Client gets random ID
    
    newPeer.on('open', () => {
        const conn = newPeer.connect(`eventguard-${code}`);
        
        conn.on('open', () => {
            setSessionId(code);
            setSyncMode('CLIENT');
            setConnections([conn]);
        });

        conn.on('data', (data: any) => handleSyncMessage(data, 'HOST'));
        
        conn.on('error', (err) => {
            console.error('Connection Error:', err);
            alert('Could not connect to host. Check code and internet.');
            setSyncMode('ALONE');
        });
    });

    setPeer(newPeer);
  };

  const broadcastMessage = (msg: SyncMessage, excludePeerId?: string) => {
     if (syncMode === 'ALONE') return;
     
     connections.forEach(conn => {
         if (conn.peer !== excludePeerId) {
             conn.send(msg);
         }
     });
  };

  const handleSyncMessage = (msg: SyncMessage, senderId: string) => {
     // console.log('Received Sync Message:', msg);

     if (msg.type === 'INIT') {
         // Full State Replace (Client Only)
         const { guests: newGuests, scanLogs: newLogs } = msg.payload;
         if (newGuests) setGuests(newGuests);
         if (newLogs) setScanLogs(newLogs);
     } 
     else if (msg.type === 'NEW_SCAN') {
         const log: ScanLog = msg.payload;
         
         // Update Local State
         setScanLogs(prev => {
             // Avoid duplicates
             if (prev.find(l => l.id === log.id)) return prev;
             return [log, ...prev];
         });
         
         // Update Guest Status
         updateGuestFromLog(log);

         // If Host, rebroadcast to other clients
         if (syncMode === 'HOST') {
             broadcastMessage(msg, senderId);
         }
     }
     else if (msg.type === 'NEW_GUEST') {
         const guest: Guest = msg.payload;
         setGuests(prev => {
             if (prev.find(g => g.id === guest.id)) return prev;
             return [...prev, guest];
         });
         
         if (syncMode === 'HOST') {
             broadcastMessage(msg, senderId);
         }
     }
  };

  const updateGuestFromLog = (log: ScanLog) => {
      setGuests(prevGuests => {
          const idx = prevGuests.findIndex(g => g.id === log.guestId);
          if (idx === -1) return prevGuests;
          
          const guest = prevGuests[idx];
          // Check if update needed
          if ((log.day === 1 && guest.checkInDay1) || (log.day === 2 && guest.checkInDay2)) {
              return prevGuests;
          }

          const updatedGuest = { ...guest };
          if (log.day === 1) updatedGuest.checkInDay1 = log.timestamp;
          else updatedGuest.checkInDay2 = log.timestamp;

          const newGuests = [...prevGuests];
          newGuests[idx] = updatedGuest;
          return newGuests;
      });
  };

  // --- Core Business Logic ---

  const handleScan = (guestId: string, day: 1 | 2): { success: boolean; message: string; guest?: Guest } => {
    const guestIndex = guests.findIndex(g => g.id === guestId);
    
    if (guestIndex === -1) {
      const log: ScanLog = {
        id: Date.now().toString() + Math.random().toString().slice(2,5),
        guestId,
        guestName: 'Unknown',
        timestamp: new Date().toISOString(),
        day,
        status: 'ERROR',
        message: 'Unknown Ticket ID'
      };
      setScanLogs(prev => [log, ...prev]);
      // Sync Error logs too? Maybe not critical, but let's do it for visibility
      broadcastMessage({ type: 'NEW_SCAN', payload: log });
      return { success: false, message: 'Unknown Ticket ID' };
    }

    const guest = guests[guestIndex];
    
    // Check for Duplication
    if (day === 1 && guest.checkInDay1) {
      const log: ScanLog = {
        id: Date.now().toString() + Math.random().toString().slice(2,5),
        guestId: guest.id,
        guestName: guest.name,
        timestamp: new Date().toISOString(),
        day,
        status: 'DUPLICATE',
        message: `Already checked in Day 1 at ${new Date(guest.checkInDay1).toLocaleTimeString()}`
      };
      setScanLogs(prev => [log, ...prev]);
      broadcastMessage({ type: 'NEW_SCAN', payload: log });
      return { success: false, message: 'Already Checked In (Day 1)', guest };
    }

    if (day === 2 && guest.checkInDay2) {
      const log: ScanLog = {
        id: Date.now().toString() + Math.random().toString().slice(2,5),
        guestId: guest.id,
        guestName: guest.name,
        timestamp: new Date().toISOString(),
        day,
        status: 'DUPLICATE',
        message: `Already checked in Day 2 at ${new Date(guest.checkInDay2).toLocaleTimeString()}`
      };
      setScanLogs(prev => [log, ...prev]);
      broadcastMessage({ type: 'NEW_SCAN', payload: log });
      return { success: false, message: 'Already Checked In (Day 2)', guest };
    }

    // Success - Update Guest
    const now = new Date().toISOString();
    const updatedGuest = { ...guest };
    if (day === 1) updatedGuest.checkInDay1 = now;
    else updatedGuest.checkInDay2 = now;

    const newGuests = [...guests];
    newGuests[guestIndex] = updatedGuest;
    setGuests(newGuests);

    const log: ScanLog = {
      id: Date.now().toString() + Math.random().toString().slice(2,5),
      guestId: guest.id,
      guestName: guest.name,
      timestamp: now,
      day,
      status: 'SUCCESS',
      message: 'Check-in Successful'
    };
    setScanLogs(prev => [log, ...prev]);
    
    // BROADCAST SCAN
    broadcastMessage({ type: 'NEW_SCAN', payload: log });

    return { success: true, message: `Welcome, ${guest.name}`, guest: updatedGuest };
  };

  const handleAddGuest = (guest: Guest) => {
    // Check for ID collision
    if (guests.find(g => g.id === guest.id)) {
        alert('Error: Guest ID already exists.');
        return;
    }
    setGuests(prev => [...prev, guest]);
    broadcastMessage({ type: 'NEW_GUEST', payload: guest });
  };

  const handleBulkImport = (newGuests: Guest[]) => {
    setGuests(prev => [...prev, ...newGuests]);
    // Note: Broadcasting 10k guests via bulk import might choke the P2P connection.
    // It is recommended to perform bulk import on HOST before clients connect.
    // If connected, we could iterate and send, but simpler to rely on INIT state for new clients.
    if (syncMode !== 'ALONE') {
        alert("Note: Bulk import during live sync is not fully broadcast to avoid network congestion. Please reconnect clients to fetch full list.");
    }
  };

  const handleMergeLogs = (externalLogs: ScanLog[]) => {
    // 1. Merge Logs
    let addedCount = 0;
    const currentLogIds = new Set(scanLogs.map(l => l.id));
    const newLogs = externalLogs.filter(l => !currentLogIds.has(l.id));
    
    if (newLogs.length === 0) return;

    const mergedLogs = [...newLogs, ...scanLogs].sort((a, b) => 
       new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setScanLogs(mergedLogs);
    addedCount = newLogs.length;

    // 2. Update Guests Status based on these new logs
    newLogs.forEach(log => {
        if(log.status === 'SUCCESS') updateGuestFromLog(log);
        // Also broadcast these merged logs? Optional, but safer to avoid storms.
        // broadcastMessage({ type: 'NEW_SCAN', payload: log });
    });
  };

  const handleDeleteGuest = (id: string) => {
    const targetId = String(id);
    setGuests(prev => prev.filter(g => String(g.id) !== targetId));
    setScanLogs(prev => prev.filter(l => String(l.guestId) !== targetId));
  };

  const handleReset = () => {
    setGuests([]);
    setScanLogs([]);
    localStorage.removeItem(STORAGE_KEY_GUESTS);
    localStorage.removeItem(STORAGE_KEY_LOGS);
    // Disconnect sync if active?
    if (peer) {
        peer.destroy();
        setPeer(null);
        setSyncMode('ALONE');
        setConnections([]);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      {/* Added pb-16 to main container to prevent content being hidden behind mobile bottom nav */}
      <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
        {currentView === 'DASHBOARD' && (
          <Dashboard 
            guests={guests} 
            logs={scanLogs} 
            onNavigateToScanner={() => setCurrentView('SCANNER')} 
          />
        )}
        {currentView === 'SCANNER' && (
          <Scanner 
            guests={guests} 
            onScan={handleScan} 
          />
        )}
        {currentView === 'REGISTRY' && (
          <Registry 
            guests={guests} 
            onDeleteGuest={handleDeleteGuest}
          />
        )}
        {currentView === 'SETUP' && (
          <Setup 
            onAddGuest={handleAddGuest}
            onBulkImport={handleBulkImport}
            onResetSystem={handleReset}
            onMergeLogs={handleMergeLogs}
            totalGuests={guests.length}
            scanLogs={scanLogs}
            // Sync Props
            syncMode={syncMode}
            sessionId={sessionId}
            connectedPeers={connections.length}
            onStartHosting={handleStartHosting}
            onJoinSession={handleJoinSession}
          />
        )}
      </main>
    </div>
  );
};

export default App;