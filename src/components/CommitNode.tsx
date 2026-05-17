import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../lib/utils';

export interface CommitNodeProps {
  data: {
    id: string;
    message: string;
    branchId: string;
    isHead: boolean;
    color: string;
    branchName: string;
    isMerge: boolean;
    messageRotated?: boolean;
    hideId?: boolean;
    isVertical?: boolean;
    labelOffsetX?: number;
  };
}

const CommitNode = ({ data }: CommitNodeProps) => {
  const isMessageEmpty = !data.message || data.message.trim() === '';
  const showLabel = !isMessageEmpty || !data.hideId;

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
      {showLabel && (
        <div 
          className={cn(
            "absolute flex flex-col z-20 transition-all cursor-pointer pointer-events-auto",
            data.isVertical
              ? "top-1/2 -translate-y-1/2 items-start opacity-100" 
              : data.messageRotated 
                ? "bottom-1/2 left-1/2 mb-2 ml-2 -rotate-45 origin-bottom-left opacity-100 items-start" 
                : "top-8 pt-2 items-center opacity-70 group-hover:opacity-100"
          )}
          style={data.isVertical ? { left: data.labelOffsetX !== undefined ? data.labelOffsetX : 32 } : undefined}
        >
          <div className={cn(
            "bg-white/95 backdrop-blur-md px-3 py-1.5 rounded border border-slate-200 shadow-sm flex flex-col transition-all",
            (data.messageRotated || data.isVertical) ? "items-start" : "items-center"
          )}>
            <div className="flex items-center gap-2">
              {!isMessageEmpty && <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{data.message}</span>}
            </div>
            {!data.hideId && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">{data.id}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* React Flow Handles */}
      <Handle 
        type="target" 
        position={data.isVertical ? Position.Bottom : Position.Left} 
        className="!w-3 !h-3 !border-2 !bg-white !opacity-0 group-hover:!opacity-100 transition-opacity"
        style={{ borderColor: data.color }}
      />
      <Handle 
        type="source" 
        position={data.isVertical ? Position.Top : Position.Right} 
        className="!w-3 !h-3 !border-2 !bg-white !opacity-0 group-hover:!opacity-100 transition-opacity"
        style={{ borderColor: data.color }}
      />
    </div>
  );
};

export default memo(CommitNode);
