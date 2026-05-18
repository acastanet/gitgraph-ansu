import React, { memo } from 'react';
import { useGitStore } from '../store/useGitStore';

interface LaneNodeProps {
  id: string;
  data: {
    name: string;
    color: string;
    width: number;
    isFirst?: boolean;
    isLast?: boolean;
    labelOffsetX?: number;
  };
}

const LaneNode = ({ id, data }: LaneNodeProps) => {
  const branchId = id.replace('lane-', '');
  const moveBranch = useGitStore(state => state.moveBranch);
  const layoutDirection = useGitStore(state => state.layoutDirection);
  const isVertical = layoutDirection === 'vertical';

  if (isVertical) {
    return (
      <div className="flex flex-col items-center relative pointer-events-none" style={{ width: 40, height: data.width }}>
        {/* Solid Line */}
        <div 
          className="h-full border-l-2 border-dashed shrink-0"
          style={{ borderColor: data.color, opacity: 0.3 }}
        />

        {/* Branch Detached Label */}
        <div 
          className={`absolute z-20 pointer-events-auto flex items-center gap-2 transition-all ${data.name !== 'main' ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ left: '50%', transform: 'rotate(-45deg)', transformOrigin: 'bottom left', top: -35 }}
        >
          <div 
            className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-white shadow-md flex items-center gap-2 border border-slate-200 border-l-4 whitespace-nowrap hover:shadow-lg hover:bg-slate-50 transition-all"
            style={{ color: '#475569', borderLeftColor: data.color }}
          >
            <div 
              className="lane-label flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
              {data.name}
            </div>
            {data.name !== 'main' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Voulez-vous vraiment supprimer la branche "${data.name}" et ses commits ?`)) {
                    useGitStore.getState().deleteBranch(branchId);
                  }
                }}
                className="ml-1 p-0.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Supprimer la branche"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center relative pointer-events-none" style={{ width: data.width, height: 40 }}>
      {/* Solid Line */}
      <div 
        className="w-full border-b-2 border-dashed shrink-0"
        style={{ borderColor: data.color, opacity: 0.3 }}
      />

      {/* Branch Detached Label */}
      <div 
        className={`absolute z-25 pointer-events-auto flex items-center gap-2 transition-all ${data.name !== 'main' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ 
          left: -15, 
          top: data.labelOffsetX !== undefined ? -data.labelOffsetX - 25 : -25,
          transform: 'rotate(-45deg)', 
          transformOrigin: 'bottom left'
        }}
      >
        <div 
          className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-white shadow-md flex items-center gap-2 border border-slate-200 border-l-4 hover:shadow-lg hover:bg-slate-50 transition-all whitespace-nowrap"
          style={{ color: '#475569', borderLeftColor: data.color }}
        >
          <div 
            className="lane-label flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
            {data.name}
          </div>
          {data.name !== 'main' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Voulez-vous vraiment supprimer la branche "${data.name}" et ses commits ?`)) {
                  useGitStore.getState().deleteBranch(branchId);
                }
              }}
              className="ml-1 p-0.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Supprimer la branche"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(LaneNode);
