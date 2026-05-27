import { memo } from 'react';
import { BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';

/**
 * Custom Git-style edge inspired by GitKraken / metro-style git graphs.
 *
 * Hybrid routing strategy:
 * - Same lane: straight line
 * - Adjacent lane (1 lane crossing): L-shape with single rounded corner
 * - Multi-lane (>= 2 lanes): cubic-bezier S-curve that exits/enters lanes
 *   along the lane direction and crosses the gap in between, without
 *   traversing intermediate lanes along the target's row/column.
 */

import { LANE_SPACING_VERTICAL, LANE_SPACING_HORIZONTAL } from '../lib/layout';

const MULTI_LANE_THRESHOLD_VERTICAL = LANE_SPACING_VERTICAL * 1.5;
const MULTI_LANE_THRESHOLD_HORIZONTAL = LANE_SPACING_HORIZONTAL * 1.5;

function GitEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
  data,
}: EdgeProps<Edge>) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const absDX = Math.abs(dx);
  const absDY = Math.abs(dy);

  const isCrossLane = (data as any)?.crossLane ?? false;
  const layoutVertical = (data as any)?.layoutVertical ?? true;

  // For cross-lane edges the path must exit/enter perpendicular to the lane axis:
  // - vertical layout + cross-lane: LEFT/RIGHT handles → horizontal-first path
  // - horizontal layout + cross-lane: TOP/BOTTOM handles → vertical-first path
  // For same-lane edges use the natural geometry.
  const useHorizontalPath = isCrossLane ? layoutVertical : absDX >= absDY;

  // Cross-lane edges always use S-curve (no L-shape regardless of distance).
  // Same-lane edges use the multi-lane threshold to choose between L-shape and S-curve.
  const isMultiLane = isCrossLane
    ? true
    : (useHorizontalPath ? absDY > MULTI_LANE_THRESHOLD_HORIZONTAL : absDX > MULTI_LANE_THRESHOLD_VERTICAL);

  let path: string;

  if (absDX < 3 && absDY < 3) {
    path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else if (!isCrossLane && !useHorizontalPath && absDX < 3) {
    path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else if (!isCrossLane && useHorizontalPath && absDY < 3) {
    path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else {
    if (isMultiLane) {
      // S-curve: control points keep tangents aligned with the departure direction.
      if (useHorizontalPath) {
        const midX = (sourceX + targetX) / 2;
        path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
      } else {
        const midY = (sourceY + targetY) / 2;
        path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
      }
    } else {
      // Adjacent: L-shape with a single rounded corner.
      const r = Math.min(24, absDX * 0.8, absDY * 0.8);

      if (useHorizontalPath) {
        const signX = Math.sign(dx);
        const signY = Math.sign(dy);
        const bendX = targetX - signX * r;
        const bendY = sourceY;
        const arcEndX = targetX;
        const arcEndY = sourceY + signY * r;

        path = [
          `M ${sourceX} ${sourceY}`,
          `L ${bendX} ${bendY}`,
          `Q ${targetX} ${sourceY}, ${arcEndX} ${arcEndY}`,
          `L ${targetX} ${targetY}`,
        ].join(' ');
      } else {
        const signX = Math.sign(dx);
        const signY = Math.sign(dy);
        const bendX = sourceX;
        const bendY = targetY - signY * r;
        const arcEndX = sourceX + signX * r;
        const arcEndY = targetY;

        path = [
          `M ${sourceX} ${sourceY}`,
          `L ${bendX} ${bendY}`,
          `Q ${sourceX} ${targetY}, ${arcEndX} ${arcEndY}`,
          `L ${targetX} ${targetY}`,
        ].join(' ');
      }
    }
  }

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        ...style,
        fill: 'none',
      }}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />
  );
}

export default memo(GitEdge);
