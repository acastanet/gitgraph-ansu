import React from 'react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 overflow-hidden font-sans">
      <div className="flex-1 relative">
        {children}
      </div>
    </div>
  );
}
