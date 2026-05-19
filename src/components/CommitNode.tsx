import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'motion/react';
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
    labelOffsetY?: number;
  };
}

const CommitNode = ({ data }: CommitNodeProps) => {
  const isMessageEmpty = !data.message || data.message.trim() === '';
  const showId = data.hideId === false;
  const showLabel = !isMessageEmpty || showId;

  return (
    <div className="relative group flex items-center justify-center pointer-events-auto" style={{ width: 32, height: 32, isolation: 'isolate' }}>
      {/* Node styling */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          "z-10 transition-all duration-200 cursor-pointer",
          "w-5 h-5 rounded-full border-[3px] group-hover:scale-125",
          data.isHead
            ? "scale-110"
            : "bg-white"
        )}
        style={{
          borderColor: data.color,
          backgroundColor: data.isHead ? data.color : undefined,
          boxShadow: data.isHead
            ? `0 0 12px ${data.color}60, 0 0 4px ${data.color}40`
            : `0 0 0 3px ${data.color}15`,
        }}
      />

      {/* HEAD pulse ring */}
      {data.isHead && (
        <div
          className="absolute w-7 h-7 rounded-full animate-ping opacity-20 pointer-events-none"
          style={{ backgroundColor: data.color }}
        />
      )}

      {/* Label/Tooltip */}
      {showLabel && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.05 }}
          className={cn(
            "absolute flex flex-col z-20 transition-all cursor-pointer pointer-events-auto",
            data.isVertical
              ? "top-1/2 -translate-y-1/2 items-start opacity-100" 
              : data.messageRotated 
                ? "bottom-1/2 left-1/2 mb-2 ml-2 -rotate-45 origin-bottom-left opacity-100 items-start" 
                : "top-8 pt-2 items-center opacity-70 group-hover:opacity-100"
          )}
          style={data.isVertical ? { 
            left: data.labelOffsetX !== undefined ? data.labelOffsetX : 32,
            top: data.labelOffsetY !== undefined ? `calc(50% + ${data.labelOffsetY}px)` : '50%'
          } : undefined}
        >
          <div 
            className={cn(
              "px-3 py-1.5 rounded-md border border-slate-200 shadow-sm bg-white flex flex-col transition-all",
              (data.messageRotated || data.isVertical) ? "items-start" : "items-center"
            )}
            style={{ borderLeft: `3px solid ${data.color}` }}
          >
            <div className="flex items-center gap-2">
              {!isMessageEmpty && <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">{data.message}</span>}
            </div>
            {showId && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono text-slate-500">
                  {data.id}
                </span>
              </div>
            )}
          </div>
        </motion.div>
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
