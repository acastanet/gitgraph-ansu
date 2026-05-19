import React, { memo } from 'react';
import { useGitStore } from '../store/useGitStore';

interface LaneNodeProps {
  id: string;
  selected?: boolean;
  data: {
    name: string;
    color: string;
    width: number;
    isFirst?: boolean;
    labelOffsetX?: number;
    laneIndex: number;
    branchLabelOrientation: 'angled' | 'vertical';
  };
}

const LaneNode = ({ id, data, selected }: LaneNodeProps) => {
  const branchId = id.replace('lane-', '');
  const setBranchLaneIndex = useGitStore(state => state.setBranchLaneIndex);
  const layoutDirection = useGitStore(state => state.layoutDirection);
  const isVertical = layoutDirection === 'vertical';

  if (isVertical) {
    return (
      <div className="flex flex-col items-center relative pointer-events-none" style={{ width: 40, height: data.width }}>
        {/* Gradient Lane Line */}
        <div
          className="h-full shrink-0 rounded-full"
          style={{
            width: 2,
            background: `linear-gradient(to bottom, transparent 0%, ${data.color}50 8%, ${data.color}50 92%, transparent 100%)`,
          }}
        />

        {/* Branch Detached Label */}
        <div 
          className={`absolute z-20 pointer-events-auto flex items-center gap-2 transition-all ${data.name !== 'main' ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ left: '50%', transform: data.branchLabelOrientation === 'vertical' ? 'rotate(-90deg)' : 'rotate(-45deg)', transformOrigin: 'bottom left', top: -35 }}
        >
          <div 
            className={`text-sm font-medium px-3 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap transition-all bg-white border ${
              selected 
                ? 'border-slate-400 ring-2 ring-slate-100 shadow-sm' 
                : 'border-slate-200 shadow-sm hover:border-slate-300'
            }`}
            style={{ color: '#334155' }}
          >
            <div 
              className="lane-label flex items-center gap-2 cursor-pointer transition-opacity"
            >
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: data.color }}
              />
              {data.name}
            </div>
            {data.name !== 'main' && selected && (
              <div className="flex items-center animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={(e) => { e.stopPropagation(); setBranchLaneIndex(branchId, Math.max(0, data.laneIndex - 1)); }}
                  className="ml-1 p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Déplacer vers la gauche / le haut"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setBranchLaneIndex(branchId, data.laneIndex + 1); }}
                  className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Déplacer vers la droite / le bas"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="w-px h-3.5 bg-slate-200 mx-1"></div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Voulez-vous vraiment supprimer la branche "${data.name}" et ses commits ?`)) {
                      useGitStore.getState().deleteBranch(branchId);
                    }
                  }}
                  className="p-0.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Supprimer la branche"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center relative pointer-events-none" style={{ width: data.width, height: 40 }}>
      {/* Gradient Lane Line */}
      <div
        className="w-full shrink-0 rounded-full"
        style={{
          height: 2,
          background: `linear-gradient(to right, transparent 0%, ${data.color}50 8%, ${data.color}50 92%, transparent 100%)`,
        }}
      />

      {/* Branch Detached Label */}
      <div 
        className={`absolute z-25 pointer-events-auto flex items-center gap-2 transition-all ${data.name !== 'main' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ 
          left: -15, 
          top: data.labelOffsetX !== undefined ? -data.labelOffsetX - 25 : -25,
          transform: data.branchLabelOrientation === 'vertical' ? 'rotate(-90deg)' : 'rotate(-45deg)', 
          transformOrigin: 'bottom left'
        }}
      >
        <div 
          className={`text-sm font-medium px-3 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap transition-all bg-white border ${
            selected 
              ? 'border-slate-400 ring-2 ring-slate-100 shadow-sm' 
              : 'border-slate-200 shadow-sm hover:border-slate-300'
          }`}
          style={{ color: '#334155' }}
        >
          <div 
            className="lane-label flex items-center gap-2 cursor-pointer transition-opacity"
          >
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: data.color }}
            />
            {data.name}
          </div>
          {data.name !== 'main' && selected && (
            <div className="flex items-center animate-in fade-in zoom-in duration-200">
              <button 
                onClick={(e) => { e.stopPropagation(); setBranchLaneIndex(branchId, Math.max(0, data.laneIndex - 1)); }}
                className="ml-1 p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Déplacer vers la gauche / le haut"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setBranchLaneIndex(branchId, data.laneIndex + 1); }}
                className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Déplacer vers la droite / le bas"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="w-px h-3.5 bg-slate-200 mx-1"></div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Voulez-vous vraiment supprimer la branche "${data.name}" et ses commits ?`)) {
                    useGitStore.getState().deleteBranch(branchId);
                  }
                }}
                className="p-0.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Supprimer la branche"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(LaneNode);
