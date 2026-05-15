import React from 'react';

export function Dialog({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-slate-800">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            ✕
          </button>
        </div>
        <div className="p-4 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}
