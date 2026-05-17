import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../lib/utils';

interface CommitNodeProps {
  data: {
    id: string;
    message: string;
    branchId: string;
    isHead: boolean;
    color: string;
    branchName: string;
    isMerge: boolean;
    messageRotated?: boolean;
  };
}

const CommitNode = ({ data }: CommitNodeProps) => {
  return (
    <div className="relative group flex items-center justify-center pointer-events-auto" style={{ width: 32, height: 32 }}>
      {/* Node styling (small circular point) */}
      <div 
        className={cn(
          "w-4 h-4 rounded-full border-4 bg-white z-10 transition-transform group-hover:scale-125 cursor-pointer",
          data.isHead ? "ring-2 ring-offset-2 ring-slate-800" : ""
        )}
        style={{ borderColor: data.color }}
      />

      {/* Label/Tooltip */}
      <div 
        className={cn(
          "absolute flex flex-col z-20 transition-all cursor-pointer pointer-events-auto",
          data.messageRotated 
            ? "bottom-1/2 left-1/2 mb-2 ml-2 -rotate-45 origin-bottom-left opacity-100 items-start" 
            : "top-8 pt-2 items-center opacity-70 group-hover:opacity-100"
        )}
      >
        <div className={cn(
          "bg-white/95 backdrop-blur-md px-3 py-1.5 rounded border border-slate-200 shadow-sm flex flex-col",
          data.messageRotated ? "items-start" : "items-center"
        )}>
          <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{data.message}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">{data.id}</span>
            {data.isHead && <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded uppercase">HEAD</span>}
          </div>
        </div>
      </div>

      {/* React Flow Handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !border-2 !bg-white !opacity-0 group-hover:!opacity-100 transition-opacity"
        style={{ borderColor: data.color }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !border-2 !bg-white !opacity-0 group-hover:!opacity-100 transition-opacity"
        style={{ borderColor: data.color }}
      />
    </div>
  );
};

export default memo(CommitNode);
