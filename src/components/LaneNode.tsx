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
        {/* Branch Head (Single Letter) */}
        <div 
          className={`w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center font-bold text-sm z-10 shadow-sm pointer-events-auto ${data.name !== 'main' ? 'cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors' : ''}`}
          style={{ borderColor: data.color, color: data.color, position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)' }}
        >
          {data.name.charAt(0).toUpperCase()}
        </div>

        {/* Solid Line */}
        <div 
          className="h-full border-l-2 border-dashed shrink-0"
          style={{ borderColor: data.color, opacity: 0.3 }}
        />

        {/* Branch Detached Label (Centered above head circle to avoid overlapping at same Y level) */}
        <div 
          className="absolute z-20 pointer-events-auto flex items-center gap-2 transition-all"
          style={{ left: '50%', transform: 'rotate(-45deg)', transformOrigin: 'bottom left', top: -75 }}
        >
          <div 
            className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-white shadow-md flex items-center gap-2 border border-slate-200 border-l-4 whitespace-nowrap hover:shadow-lg transition-shadow"
            style={{ color: '#475569', borderLeftColor: data.color }}
          >
            <div 
              className="lane-label flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
              {data.name}
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
        className={`w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center font-bold text-sm z-10 shadow-sm pointer-events-auto ${data.name !== 'main' ? 'cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors' : ''}`}
        style={{ borderColor: data.color, color: data.color, position: 'absolute', left: -30, top: '50%', transform: 'translateY(-50%)' }}
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
        className="absolute z-25 pointer-events-auto flex items-center gap-2 transition-all"
        style={{ 
          left: -30, 
          top: data.labelOffsetX !== undefined ? -data.labelOffsetX - 45 : -45,
          transform: 'rotate(-45deg)', 
          transformOrigin: 'bottom left'
        }}
      >
        <div 
          className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-white shadow-md flex items-center gap-2 border border-slate-200 border-l-4 hover:shadow-lg transition-shadow"
          style={{ color: '#475569', borderLeftColor: data.color }}
        >
          <div 
            className="lane-label flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
            {data.name}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LaneNode);
