import { Commit, Branch } from '../types/git';

export const BASE_VERTICAL_Y = 800;
export const LANE_SPACING_VERTICAL = 50;
export const LANE_SPACING_HORIZONTAL = 80;
export const COMMIT_STEP_VERTICAL = 150;
export const COMMIT_STEP_HORIZONTAL = 250;
export const COMMIT_STEP_OFFSET_H = 150;

export interface LayoutResult {
  commitList: Commit[];
  branchList: Branch[];
  branchRanges: Record<string, { minProp: number; maxProp: number }>;
  branchLanes: Record<string, number>;
  maxLane: number;
  isVertical: boolean;
}

export function computeLayout(
  commits: Record<string, Commit>,
  branches: Record<string, Branch>,
  historyCurrentSequence: number | null,
  layoutDirection: 'horizontal' | 'vertical',
): LayoutResult {
  const isVertical = layoutDirection === 'vertical';

  let commitList = Object.values(commits).sort((a, b) => a.timestamp - b.timestamp);
  if (historyCurrentSequence !== null) {
    commitList = commitList.slice(0, historyCurrentSequence);
  }

  const branchList = Object.values(branches).sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    if (a.name === 'main') return -1;
    if (b.name === 'main') return 1;
    return a.name.localeCompare(b.name);
  });

  const branchRanges: Record<string, { minProp: number; maxProp: number }> = {};

  commitList.forEach((commit, i) => {
    let progression: number;
    if (isVertical) {
      const defaultY = BASE_VERTICAL_Y - i * COMMIT_STEP_VERTICAL;
      progression = commit.position?.y ?? defaultY;
    } else {
      const defaultX = i * COMMIT_STEP_HORIZONTAL + COMMIT_STEP_OFFSET_H;
      progression = commit.position?.x ?? defaultX;
    }

    // Commits vides servent de terminateurs manuels de lane — exclus des extents
    const isPlaceholder = !commit.message || commit.message.trim() === '';
    if (isPlaceholder) return;

    if (!branchRanges[commit.branch]) {
      branchRanges[commit.branch] = { minProp: progression, maxProp: progression };
    } else {
      branchRanges[commit.branch].minProp = Math.min(branchRanges[commit.branch].minProp, progression);
      branchRanges[commit.branch].maxProp = Math.max(branchRanges[commit.branch].maxProp, progression);
    }
  });

  const branchLanes: Record<string, number> = {};
  let laneCounter = 0;
  branchList.forEach((branch) => {
    if (branch.customLaneIndex !== undefined) {
      branchLanes[branch.id] = branch.customLaneIndex;
    } else {
      if (branch.name === 'main') {
        branchLanes[branch.id] = 0;
      } else {
        if (laneCounter === 0) laneCounter = 1;
        branchLanes[branch.id] = laneCounter;
        laneCounter++;
      }
    }
  });

  const maxLane = Math.max(0, ...Object.values(branchLanes));

  return { commitList, branchList, branchRanges, branchLanes, maxLane, isVertical };
}
