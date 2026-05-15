import React, { memo } from 'react';

interface LaneNodeProps {
  data: {
    name: string;
    color: string;
    width: number;
  };
}

const LaneNode = ({ data }: LaneNodeProps) => {
  return (
    <div className="flex items-center relative pointer-events-none" style={{ width: data.width, height: 40 }}>
      {/* Branch Label */}
      <div 
        className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded-full bg-white border border-slate-200 absolute z-10 whitespace-nowrap shadow-sm pointer-events-auto flex items-center gap-2"
        style={{ color: '#475569', left: 20, top: -14 }}
      >
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
        {data.name}
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
