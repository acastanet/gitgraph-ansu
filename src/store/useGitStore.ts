import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';
import { Commit, Branch, GitGraphExport } from '../types/git';

const COLORS = [
  "#FF0055", // Vivid Pink/Red
  "#00C4CC", // Vivid Cyan
  "#8A2BE2", // Blue Violet
  "#F2B705", // Vivid Yellow
  "#FF6600", // Vivid Orange
  "#00B33C", // Vivid Green
  "#0066FF"  // Vivid Blue
];

interface GitState {
  commits: Record<string, Commit>;
  branches: Record<string, Branch>;
  activeBranch: string | null;
  commitSequence: number;
  historyCurrentSequence: number | null;
  layoutDirection: 'horizontal' | 'vertical';

  // Actions
  setLayoutDirection: (layout: 'horizontal' | 'vertical') => void;
  createCommit: (message?: string) => void;
  createBranch: (name: string, headCommitId: string) => void;
  mergeBranches: (sourceBranchId: string, targetBranchId: string, message?: string) => void;
  setActiveBranch: (branchId: string) => void;
  updateCommitPosition: (commitId: string, position: { x: number, y: number }) => void;
  updateCommitMessage: (commitId: string, message: string, messageRotated?: boolean, hideId?: boolean) => void;
  addParentToCommit: (childId: string, parentId: string) => void;
  removeParentFromCommit: (childId: string, parentId: string) => void;
  updateEdgeColor: (childId: string, parentId: string, color: string) => void;
  updateBranchName: (branchId: string, name: string) => void;
  setBranchLaneIndex: (branchId: string, laneIndex: number | null) => void;
  moveBranch: (branchId: string, direction: 'up' | 'down') => void;
  deleteCommit: (commitId: string) => void;
  deleteBranch: (branchId: string) => void;
  createCommitAt: (branchId: string, position: { x: number, y: number }) => void;
  createBranchWithCommit: (position: { x: number, y: number }) => void;
  loadGraph: (data: GitGraphExport) => void;
  getSavedGraph: () => GitGraphExport;
  reset: () => void;
  setHistorySequence: (seq: number | null) => void;
  
  // Helpers
  getNextColor: () => string;
}

export const useGitStore = create<GitState>()(
  temporal(
    persist(
      (set, get) => {
      const getNextColor = () => {
    const { branches } = get();
    const usedColors = Object.values(branches).map(b => b.color);
    const available = COLORS.filter(c => !usedColors.includes(c));
    return available.length > 0 ? available[0] : COLORS[Object.keys(branches).length % COLORS.length];
  };

  const initialBranchId = uuidv4();
  const initialBranchColor = COLORS[0];

  return {
    commits: {},
    branches: {
      [initialBranchId]: {
        id: initialBranchId,
        name: 'main',
        head: null,
        color: initialBranchColor,
        order: 0,
      }
    },
    activeBranch: initialBranchId,
    commitSequence: 0,
    historyCurrentSequence: null,
    layoutDirection: 'vertical',

    setLayoutDirection: (layout) => set({ layoutDirection: layout }),

    createCommit: (message) => set((state) => {
      console.log("GitStore: createCommit", message);
      if (!state.activeBranch) return state;

      const branch = state.branches[state.activeBranch];
      const commitId = uuidv4().substring(0, 8); // Short IDs for git
      
      let newX = undefined;
      let newY = undefined;
      if (branch.head) {
        const headCommit = state.commits[branch.head];
        if (headCommit) {
           // We place the new commit 250px to the right of the parent
           const headX = headCommit.position?.x;
           const headY = headCommit.position?.y;
           if (headX !== undefined) {
             newX = headX + 250;
           } else {
             newX = Object.keys(state.commits).length * 250 + 150;
           }
           if (headY !== undefined) {
             newY = headY;
           }
        }
      } else {
        newX = 150;
      }

      const newCommit: Commit = {
        id: commitId,
        message: message || `Update ${commitId}`,
        parents: branch.head ? [branch.head] : [],
        branch: branch.id,
        timestamp: Date.now(),
        hideId: true,
        ...(newX !== undefined ? { position: { x: newX, y: newY ?? 0 } } : {})
      };

      return {
        commits: { ...state.commits, [commitId]: newCommit },
        branches: {
          ...state.branches,
          [branch.id]: { ...branch, head: commitId }
        },
        commitSequence: state.commitSequence + 1
      };
    }),

    createCommitAt: (branchId, position) => set((state) => {
      console.log("GitStore: createCommitAt", branchId, position);
      const commitId = uuidv4().substring(0, 8);
      const branch = state.branches[branchId];
      if (!branch) return state;

      // Use the head of the selected branch as parent if it exists
      const newCommit: Commit = {
        id: commitId,
        message: `Update ${commitId}`,
        parents: branch.head ? [branch.head] : [],
        branch: branch.id,
        timestamp: Date.now(),
        hideId: true,
        position
      };

      return {
        commits: { ...state.commits, [commitId]: newCommit },
        branches: {
          ...state.branches,
          [branch.id]: { ...branch, head: commitId }
        },
        commitSequence: state.commitSequence + 1,
        activeBranch: branchId
      };
    }),

    createBranchWithCommit: (position) => set((state) => {
      console.log("GitStore: createBranchWithCommit", position);
      const branchId = uuidv4();
      const commitId = uuidv4().substring(0, 8);
      const color = getNextColor();

      const newBranch: Branch = {
        id: branchId,
        name: String.fromCharCode(64 + Object.keys(state.branches).length), // A, B, C...
        head: commitId,
        color,
        order: Object.keys(state.branches).length
      };

      const newCommit: Commit = {
        id: commitId,
        message: `Initial commit on ${newBranch.name}`,
        parents: [],
        branch: branchId,
        timestamp: Date.now(),
        hideId: true,
        position
      };

      return {
        commits: { ...state.commits, [commitId]: newCommit },
        branches: {
          ...state.branches,
          [branchId]: newBranch
        },
        commitSequence: state.commitSequence + 1,
        activeBranch: branchId
      };
    }),

    createBranch: (name, headCommitId) => set((state) => {
      console.log("GitStore: createBranch", name);
      const branchId = uuidv4();
      const color = getNextColor();

      return {
        branches: {
          ...state.branches,
          [branchId]: {
            id: branchId,
            name,
            head: headCommitId,
            color,
            order: Object.keys(state.branches).length
          }
        },
        activeBranch: branchId // Checkout new branch automatically
      };
    }),

    mergeBranches: (sourceBranchId, targetBranchId, message) => set((state) => {
      console.log("GitStore: mergeBranches", sourceBranchId, targetBranchId);
      const sourceBranch = state.branches[sourceBranchId];
      const targetBranch = state.branches[targetBranchId];

      if (!sourceBranch || !targetBranch) return state;
      if (!sourceBranch.head || !targetBranch.head) return state; // Nothing to merge
      if (sourceBranch.id === targetBranch.id) return state;

      const commitId = uuidv4().substring(0, 8);
      const newCommit: Commit = {
        id: commitId,
        message: message || `Merge branch '${sourceBranch.name}' into ${targetBranch.name}`,
        parents: [targetBranch.head, sourceBranch.head],
        branch: targetBranch.id,
        timestamp: Date.now(),
      };

      return {
        commits: { ...state.commits, [commitId]: newCommit },
        branches: {
          ...state.branches,
          [targetBranch.id]: { ...targetBranch, head: commitId }
        },
        commitSequence: state.commitSequence + 1,
        activeBranch: targetBranch.id, // Ensure target branch is active
      };
    }),

    setActiveBranch: (branchId) => set({ activeBranch: branchId }),

    updateCommitPosition: (commitId, position) => set((state) => {
      console.log("GitStore: updateCommitPosition", commitId, position);
      const commit = state.commits[commitId];
      if (!commit) return state;
      return {
        commits: {
          ...state.commits,
          [commitId]: { ...commit, position }
        }
      };
    }),

    updateCommitMessage: (commitId, message, messageRotated, hideId) => set((state) => {
      console.log("GitStore: updateCommitMessage", commitId, message, messageRotated, hideId);
      const commit = state.commits[commitId];
      if (!commit) return state;
      return {
        commits: {
          ...state.commits,
          [commitId]: { ...commit, message, messageRotated, hideId }
        }
      };
    }),

    addParentToCommit: (childId, parentId) => set((state) => {
      console.log("GitStore: addParentToCommit", childId, parentId);
      const child = state.commits[childId];
      if (!child) return state;
      if (child.parents.includes(parentId)) return state; // Already a parent
      return {
        commits: {
          ...state.commits,
          [childId]: { ...child, parents: [...child.parents, parentId] }
        }
      };
    }),

    removeParentFromCommit: (childId, parentId) => set((state) => {
      console.log("GitStore: removeParentFromCommit", childId, parentId);
      const child = state.commits[childId];
      if (!child) return state;
      return {
        commits: {
          ...state.commits,
          [childId]: { ...child, parents: child.parents.filter(id => id !== parentId) }
        }
      };
    }),

    updateEdgeColor: (childId, parentId, color) => set((state) => {
      console.log("GitStore: updateEdgeColor", childId, parentId, color);
      const child = state.commits[childId];
      if (!child) return state;
      return {
        commits: {
          ...state.commits,
          [childId]: {
             ...child, 
             parentColors: { ...(child.parentColors || {}), [parentId]: color }
          }
        }
      };
    }),

    updateBranchName: (branchId, name) => set((state) => {
      console.log("GitStore: updateBranchName", branchId, name);
      const branch = state.branches[branchId];
      if (!branch) return state;
      return {
        branches: {
          ...state.branches,
          [branchId]: { ...branch, name }
        }
      };
    }),

    setBranchLaneIndex: (branchId, laneIndex) => set((state) => {
      console.log("GitStore: setBranchLaneIndex", branchId, laneIndex);
      const branch = state.branches[branchId];
      if (!branch) return state;
      return {
        branches: {
          ...state.branches,
          [branchId]: { 
            ...branch, 
            customLaneIndex: laneIndex !== null ? laneIndex : undefined 
          }
        }
      };
    }),

    moveBranch: (branchId, direction) => set((state) => {
      console.log("GitStore: moveBranch", branchId, direction);
      
      const branchList = Object.values(state.branches).sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        if (a.name === 'main') return -1;
        if (b.name === 'main') return 1;
        return a.name.localeCompare(b.name);
      });

      // Initialize order if it doesn't exist
      branchList.forEach((b, index) => {
        if (b.order === undefined) b.order = index;
      });

      const currentIndex = branchList.findIndex(b => b.id === branchId);
      if (currentIndex === -1) return state;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= branchList.length) return state;

      // Swap orders
      const currentBranch = branchList[currentIndex];
      const targetBranch = branchList[targetIndex];
      
      const tempOrder = currentBranch.order;
      currentBranch.order = targetBranch.order;
      targetBranch.order = tempOrder;

      return {
        branches: {
          ...state.branches,
          [currentBranch.id]: { ...currentBranch },
          [targetBranch.id]: { ...targetBranch }
        }
      };
    }),

    deleteCommit: (commitId) => set((state) => {
      console.log("GitStore: deleteCommit", commitId);
      const newCommits = { ...state.commits };
      delete newCommits[commitId];
      
      Object.keys(newCommits).forEach(id => {
        if (newCommits[id].parents.includes(commitId)) {
          newCommits[id] = {
            ...newCommits[id],
            parents: newCommits[id].parents.filter(p => p !== commitId)
          };
        }
      });
      
      const newBranches = { ...state.branches };
      Object.values(newBranches).forEach(b => {
        if (b.head === commitId) {
          const branchCommits = Object.values(newCommits).filter(c => c.branch === b.id).sort((a,b) => b.timestamp - a.timestamp);
          newBranches[b.id] = { ...b, head: branchCommits.length > 0 ? branchCommits[0].id : '' };
        }
      });

      return { commits: newCommits, branches: newBranches };
    }),

    deleteBranch: (branchId) => set((state) => {
      console.log("GitStore: deleteBranch", branchId);
      const branch = state.branches[branchId];
      if (!branch || branch.name === 'main') return state;

      const newBranches = { ...state.branches };
      delete newBranches[branchId];

      const commitsToDelete = Object.values(state.commits)
        .filter(c => c.branch === branchId)
        .map(c => c.id);

      const newCommits = { ...state.commits };
      commitsToDelete.forEach(commitId => {
        delete newCommits[commitId];
      });

      // Remove deleted commits from parent lists
      Object.keys(newCommits).forEach(id => {
        const commit = newCommits[id];
        const filteredParents = commit.parents.filter(p => !commitsToDelete.includes(p));
        if (filteredParents.length !== commit.parents.length) {
          newCommits[id] = {
            ...commit,
            parents: filteredParents
          };
        }
      });

      // Adjust active branch if it was deleted
      let newActiveBranch = state.activeBranch;
      if (state.activeBranch === branchId) {
        const mainBranch = Object.values(newBranches).find(b => b.name === 'main');
        if (mainBranch) {
          newActiveBranch = mainBranch.id;
        } else {
          const firstBranch = Object.keys(newBranches)[0];
          newActiveBranch = firstBranch || null;
        }
      }

      return {
        branches: newBranches,
        commits: newCommits,
        activeBranch: newActiveBranch
      };
    }),

    loadGraph: (data) => set({ ...data }),

    getSavedGraph: () => {
      const { commits, branches, commitSequence, activeBranch } = get();
      return { commits, branches, commitSequence, activeBranch };
    },

    reset: () => {
      console.log("GitStore: reset");
      const mainId = uuidv4();
      set({
        commits: {},
        branches: {
           [mainId]: {
            id: mainId,
            name: 'main',
            head: null,
            color: COLORS[0],
            order: 0,
          }
        },
        activeBranch: mainId,
        commitSequence: 0,
        historyCurrentSequence: null,
        // don't wipe layout on reset
      });
    },

    setHistorySequence: (seq) => set({ historyCurrentSequence: seq }),

    getNextColor,
  };
}, {
  name: 'git-graph-storage',
  partialize: (state) => ({ 
    commits: state.commits, 
    branches: state.branches, 
    activeBranch: state.activeBranch,
    commitSequence: state.commitSequence,
    layoutDirection: state.layoutDirection || 'vertical',
  }),
}),
{
      partialize: (state) => ({
        commits: state.commits,
        branches: state.branches,
        activeBranch: state.activeBranch,
        commitSequence: state.commitSequence,
        layoutDirection: state.layoutDirection || 'vertical',
      }),
      limit: 50,
    }
  )
);
