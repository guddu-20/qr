import React from 'react';
import { LayoutDashboard, QrCode, Users, Settings, ShieldCheck } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const navItems: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'SCANNER', label: 'Scanner', icon: <QrCode size={20} /> },
    { id: 'REGISTRY', label: 'Registry', icon: <Users size={20} /> },
    { id: 'SETUP', label: 'Setup', icon: <Settings size={20} /> },
  ];

  return (
    <div className="
      fixed bottom-0 left-0 w-full h-16 bg-slate-900 text-white flex flex-row justify-around items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]
      md:relative md:w-64 md:h-full md:flex-col md:justify-start md:items-stretch md:flex-shrink-0 md:shadow-none
    ">
      {/* Header - Desktop Only */}
      <div className="hidden md:block p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="text-blue-500" size={28} />
          <h1 className="text-xl font-bold tracking-tight">EventGuard</h1>
        </div>
        <p className="text-xs text-slate-500 font-semibold tracking-widest pl-9">10K SCALE READY</p>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 w-full px-2 flex flex-row justify-around items-center md:flex-col md:justify-start md:px-4 md:space-y-2 md:mt-4 md:items-stretch">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`
              flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200
              md:flex-row md:gap-3 md:px-4 md:py-3 md:justify-start
              ${
                currentView === item.id
                  ? 'text-blue-400 md:bg-blue-600 md:text-white md:shadow-lg md:shadow-blue-900/50 font-medium'
                  : 'text-slate-400 hover:text-slate-200 md:hover:bg-slate-800 md:hover:text-white'
              }
            `}
          >
            {/* Clone element to adjust size on mobile if needed, though size=20 is fine */}
            {item.icon}
            <span className="text-[10px] mt-1 md:mt-0 md:text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer - Desktop Only */}
      <div className="hidden md:block p-6 border-t border-slate-800">
        <div className="text-xs text-slate-500 text-center">
          v2.4.0 &copy; 2024 EventGuard
        </div>
      </div>
    </div>
  );
};

export default Sidebar;