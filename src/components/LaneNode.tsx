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
  };
}

const LaneNode = ({ id, data }: LaneNodeProps) => {
  const branchId = id.replace('lane-', '');
  const moveBranch = useGitStore(state => state.moveBranch);

  return (
    <div className="flex items-center relative pointer-events-none" style={{ width: data.width, height: 40 }}>
      {/* Branch Label */}
      <div 
        className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded-full bg-white border border-slate-200 absolute z-10 whitespace-nowrap shadow-sm pointer-events-auto flex items-center gap-2"
        style={{ color: '#475569', left: 20, top: -14 }}
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
      {/* Solid Line */}
      <div 
        className="w-full border-b-2 border-dashed shrink-0"
        style={{ borderColor: data.color, opacity: 0.3 }}
      />
    </div>
  );
};

export default memo(LaneNode);
