import React from 'react';
import Toolbar from '../components/Toolbar';
import StatusBar from '../components/StatusBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 overflow-hidden font-sans">
      <Toolbar />
      <div className="flex-1 relative">
        {children}
      </div>
      <StatusBar />
    </div>
  );
}
