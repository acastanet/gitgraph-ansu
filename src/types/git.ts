export type Commit = {
  id: string;
  message: string;
  parents: string[];
  branch: string;
  timestamp: number;
  position?: { x: number, y: number };
  parentColors?: Record<string, string>;
  messageRotated?: boolean;
  hideId?: boolean;
};

export type Branch = {
  id: string;
  name: string;
  head: string | null;
  color: string;
  order?: number;
  customLaneIndex?: number;
  customEndPosition?: number; // explicit lane terminator (Y in vertical, X in horizontal)
};

export type GitGraphExport = {
  commits: Record<string, Commit>;
  branches: Record<string, Branch>;
  commitSequence: number;
  activeBranch: string | null;
};
