import React, { memo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
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
        {/* Branch Head (Single Letter) */}
        <div 
          className="w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center font-bold text-sm z-10 shadow-sm pointer-events-auto"
          style={{ borderColor: data.color, color: data.color, position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)' }}
        >
          {data.name.charAt(0).toUpperCase()}
        </div>

        {/* Solid Line */}
        <div 
          className="h-full border-l-2 border-dashed shrink-0"
          style={{ borderColor: data.color, opacity: 0.3 }}
        />

        {/* Branch Detached Label */}
        <div 
          className="absolute z-10 pointer-events-auto flex items-center gap-2 transition-all"
          style={{ left: data.labelOffsetX !== undefined ? data.labelOffsetX + 20 : 60, top: -20 }}
        >
          <div 
            className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-white shadow-sm flex items-center gap-2 border border-slate-200"
            style={{ color: '#475569' }}
          >
            <div 
              className="lane-label flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
              {data.name}
            </div>
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
              <button 
                type="button"
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'up'); }}
                disabled={data.isFirst}
                title="Déplacer à gauche"
              >
                <ChevronUp size={14} className="-rotate-90"/>
              </button>
              <button 
                type="button"
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'down'); }}
                disabled={data.isLast}
                title="Déplacer à droite"
              >
                <ChevronDown size={14} className="-rotate-90"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center relative pointer-events-none" style={{ width: data.width, height: 40 }}>
      {/* Branch Head (Single Letter) */}
      <div 
        className="w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center font-bold text-sm z-10 shadow-sm pointer-events-auto"
        style={{ borderColor: data.color, color: data.color, position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)' }}
      >
        {data.name.charAt(0).toUpperCase()}
      </div>

      {/* Solid Line */}
      <div 
        className="w-full border-b-2 border-dashed shrink-0"
        style={{ borderColor: data.color, opacity: 0.3 }}
      />

      {/* Branch Detached Label */}
      <div 
        className="absolute z-10 pointer-events-auto flex items-center gap-2 transition-all"
        style={{ left: -20, top: data.labelOffsetX !== undefined ? -data.labelOffsetX - 45 : -45 }}
      >
        <div 
          className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-white shadow-sm flex items-center gap-2 border border-slate-200"
          style={{ color: '#475569' }}
        >
          <div 
            className="lane-label flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
            {data.name}
          </div>
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
            <button 
              type="button"
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'up'); }}
              disabled={data.isFirst}
              title="Monter"
            >
              <ChevronUp size={14} />
            </button>
            <button 
              type="button"
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'down'); }}
              disabled={data.isLast}
              title="Descendre"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LaneNode);
