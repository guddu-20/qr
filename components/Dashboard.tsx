import React from 'react';
import { Users, CheckCircle2, History, ArrowRight } from 'lucide-react';
import { Guest, ScanLog } from '../types';

interface DashboardProps {
  guests: Guest[];
  logs: ScanLog[];
  onNavigateToScanner: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ guests, logs, onNavigateToScanner }) => {
  // Compute Stats
  const totalGuests = guests.length;
  const day1CheckIns = guests.filter(g => g.checkInDay1 !== null).length;
  const day2CheckIns = guests.filter(g => g.checkInDay2 !== null).length;

  const day1Percentage = totalGuests === 0 ? 0 : Math.round((day1CheckIns / totalGuests) * 100);
  const day2Percentage = totalGuests === 0 ? 0 : Math.round((day2CheckIns / totalGuests) * 100);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Event Overview</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Live analytics for 2-day cultural event</p>
        </div>
        <button
          onClick={onNavigateToScanner}
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 md:py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          Launch Station <ArrowRight size={18} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* Total Guest List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Guest List</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{totalGuests.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Registered Participants</p>
          </div>
        </div>

        {/* Day 1 Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 z-10 flex-shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="z-10 w-full">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Day 1 Check-ins</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{day1CheckIns.toLocaleString()}</p>
            <div className="w-full md:w-32 h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${day1Percentage}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-1">{day1Percentage}% Attended</p>
          </div>
        </div>

        {/* Day 2 Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 z-10 flex-shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="z-10 w-full">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Day 2 Check-ins</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{day2CheckIns.toLocaleString()}</p>
            <div className="w-full md:w-32 h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: `${day2Percentage}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-1">{day2Percentage}% Attended</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 mb-20 md:mb-0">
        <div className="flex items-center gap-2 mb-6">
          <History size={20} className="text-slate-400" />
          <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
            <p className="text-slate-400">No scans recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 min-w-[500px]">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="pb-3 pl-2 font-semibold">Time</th>
                  <th className="pb-3 font-semibold">Guest</th>
                  <th className="pb-3 font-semibold">Event Day</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pl-2 text-slate-400 font-mono text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 font-medium text-slate-900">{log.guestName}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                        log.day === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        Day {log.day}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'SUCCESS' ? 'bg-green-50 text-green-700 border border-green-100' :
                        log.status === 'DUPLICATE' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;