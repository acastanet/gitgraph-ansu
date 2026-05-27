import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  MarkerType,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toSvg, toPng } from 'html-to-image';
import { Save, Download, Crosshair, Upload, HelpCircle, FileJson, Image, Undo, Redo, RefreshCcw, LayoutGrid, List } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { computeLayout, BASE_VERTICAL_Y, LANE_SPACING_VERTICAL, LANE_SPACING_HORIZONTAL, COMMIT_STEP_VERTICAL, COMMIT_STEP_HORIZONTAL, COMMIT_STEP_OFFSET_H } from '../lib/layout';
import CommitNode from './CommitNode';
import LaneNode from './LaneNode';
import GitEdge from './GitEdge';
import EndCapNode from './EndCapNode';
import { Dialog } from './Dialog';

const nodeTypes = {
  commit: CommitNode,
  lane: LaneNode,
  endcap: EndCapNode,
};

const edgeTypes = {
  gitEdge: GitEdge,
};

function GitGraphInner() {
  // Données réactives — sélecteurs ciblés
  const commits = useGitStore(s => s.commits);
  const branches = useGitStore(s => s.branches);
  const activeBranch = useGitStore(s => s.activeBranch);
  const historyCurrentSequence = useGitStore(s => s.historyCurrentSequence);
  const layoutDirection = useGitStore(s => s.layoutDirection);
  const branchLabelOrientation = useGitStore(s => s.branchLabelOrientation);

  // Actions — références stables
  const setActiveBranch = useGitStore(s => s.setActiveBranch);
  const updateCommitPosition = useGitStore(s => s.updateCommitPosition);
  const addParentToCommit = useGitStore(s => s.addParentToCommit);
  const createCommitAt = useGitStore(s => s.createCommitAt);
  const createBranchWithCommit = useGitStore(s => s.createBranchWithCommit);
  const createBranch = useGitStore(s => s.createBranch);
  const updateBranchName = useGitStore(s => s.updateBranchName);
  const updateBranchColor = useGitStore(s => s.updateBranchColor);
  const setLayoutDirection = useGitStore(s => s.setLayoutDirection);
  const toggleBranchLabelOrientation = useGitStore(s => s.toggleBranchLabelOrientation);
  const resetStore = useGitStore(s => s.reset);
  const { undo, redo } = useGitStore.temporal.getState();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [branchPrompt, setBranchPrompt] = useState<{ isOpen: boolean, commitId: string, name: string }>({ isOpen: false, commitId: '', name: '' });
  const [renameBranchPrompt, setRenameBranchPrompt] = useState<{ isOpen: boolean, branchId: string, name: string, color: string }>({ isOpen: false, branchId: '', name: '', color: '' });
  const [colorPrompt, setColorPrompt] = useState<{ isOpen: boolean, edge: Edge | null, color: string }>({ isOpen: false, edge: null, color: '' });
  const [commitPrompt, setCommitPrompt] = useState<{ isOpen: boolean, commitId: string, message: string, messageRotated: boolean, hideId: boolean }>({ isOpen: false, commitId: '', message: '', messageRotated: false, hideId: false });
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [helpPromptOpen, setHelpPromptOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [loadErrorOpen, setLoadErrorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportImage = useCallback((format: 'svg' | 'png') => {
    setSavePromptOpen(false);
    setTimeout(() => {
      const allNodes = getNodes();
      if (allNodes.length === 0) return;

      const nodesBounds = getNodesBounds(allNodes);
      const isVert = useGitStore.getState().layoutDirection === 'vertical';

      // Les labels de commits sont positionnés en débordement (overflow) hors des 32×32 px
      // du nœud. getNodesBounds ne les voit pas. On calcule le vrai bord droit.
      let rightExtent = nodesBounds.x + nodesBounds.width;
      if (isVert) {
        allNodes.filter(n => n.type === 'commit').forEach(node => {
          const offsetX = (node.data as Record<string, unknown>).labelOffsetX as number | undefined;
          if (offsetX != null) {
            rightExtent = Math.max(rightExtent, node.position.x + offsetX + 280);
          }
        });
      }

      // Marges : haut généreux pour les labels de lanes pivotés à -45°/-90°
      const PAD_TOP = isVert ? 220 : 100;
      const PAD_BOTTOM = 80;
      const PAD_LEFT = 80;
      const PAD_RIGHT = 80;

      const bx = nodesBounds.x - PAD_LEFT;
      const by = nodesBounds.y - PAD_TOP;
      const width = (rightExtent + PAD_RIGHT) - bx;
      const height = nodesBounds.height + PAD_TOP + PAD_BOTTOM;

      const bounds = { x: bx, y: by, width, height };
      const transform = getViewportForBounds(bounds, width, height, 0.1, 2, 0);

      const el = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!el) return;

      const exportFn = format === 'svg' ? toSvg : toPng;
      exportFn(el, {
        backgroundColor: '#f8fafc',
        width,
        height,
        style: {
          width: width.toString(),
          height: height.toString(),
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        },
      }).then((dataUrl) => {
        const a = document.createElement('a');
        a.setAttribute('download', `git-graph.${format}`);
        a.setAttribute('href', dataUrl);
        a.click();
      }).catch((err) => {
        console.error(`Failed to export ${format.toUpperCase()}`, err);
      });
    }, 200);
  }, [getNodes]);

  const handleExportJSON = useCallback(() => {
    setSavePromptOpen(false);
    const data = useGitStore.getState().getSavedGraph();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'git-graph.json';
    a.click();
    URL.revokeObjectURL(url);
    setSavePromptOpen(false);
  }, []);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          useGitStore.getState().loadGraph(JSON.parse(content));
        } catch (err) {
          setLoadErrorOpen(true);
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFitViewCommits = useCallback(() => {
    const commitNodes = nodes.filter(n => n.type === 'commit');
    fitView({ nodes: commitNodes.length > 0 ? commitNodes : undefined, padding: 0.5, duration: 800 });
  }, [nodes, fitView]);

  const onNodesChangeCustom = useCallback((changes: any[]) => {
    const modifiedChanges = changes.map(c => {
      if (c.type === 'position' && c.position) {
        const node = nodes.find(n => n.id === c.id);
        if (node) {
          const isVertical = layoutDirection === 'vertical';
          if (node.type === 'lane') {
            // Dragging lane node:
            // In vertical: Y coordinate is locked, X is free to move between columns.
            // In horizontal: X coordinate is locked, Y is free to move between rows.
            return {
              ...c,
              position: isVertical ? { x: c.position.x, y: node.position.y } : { x: node.position.x, y: c.position.y }
            };
          } else if (node.type === 'endcap') {
            // Dragging endcap: locked to lane axis, free along time axis.
            // In vertical: X locked, Y free.
            // In horizontal: Y locked, X free.
            return {
              ...c,
              position: isVertical ? { x: node.position.x, y: c.position.y } : { x: c.position.x, y: node.position.y }
            };
          } else {
            // Dragging commit node:
            // In vertical: X coordinate is locked to lane, Y is free (time).
            // In horizontal: Y coordinate is locked to lane, X is free (time).
            return {
              ...c,
              position: isVertical ? { x: node.position.x, y: c.position.y } : { x: c.position.x, y: node.position.y }
            };
          }
        }
      }
      return c;
    });
    onNodesChange(modifiedChanges);
  }, [nodes, onNodesChange, layoutDirection]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'commit') {
      updateCommitPosition(node.id, { x: node.position.x, y: node.position.y });
    } else if (node.type === 'lane') {
      const branchId = node.id.replace('lane-', '');
      const isVertical = layoutDirection === 'vertical';
      const targetLane = isVertical
        ? Math.max(0, Math.round((node.position.x - 100) / LANE_SPACING_VERTICAL))
        : Math.max(0, Math.round((node.position.y - 80) / LANE_SPACING_HORIZONTAL));
      useGitStore.getState().setBranchLaneIndex(branchId, targetLane);
    } else if (node.type === 'endcap') {
      const branchId = node.id.replace('endcap-', '');
      const isVertical = layoutDirection === 'vertical';
      const endPos = isVertical ? node.position.y : node.position.x;
      useGitStore.getState().setBranchEndPosition(branchId, endPos);
    }
  }, [updateCommitPosition, layoutDirection]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.react-flow__node-commit')) {
      return; // Ignore double clicks on commit nodes
    }

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    const { commitList, branchList, branchRanges, branchLanes, isVertical } = computeLayout(
      commits, branches, historyCurrentSequence, layoutDirection
    );

    const clickedLane = isVertical
      ? Math.max(0, Math.round((position.x - 100) / LANE_SPACING_VERTICAL))
      : Math.max(0, Math.round((position.y - 80) / LANE_SPACING_HORIZONTAL));

    const targetBranches = branchList.filter(b => branchLanes[b.id] === clickedLane);

    if (targetBranches.length > 0) {
      // Find the branch whose range is closest to the click coordinate
      let closestBranch = targetBranches[0];
      let minDistance = Infinity;
      targetBranches.forEach(b => {
        const range = branchRanges[b.id];
        const minP = range ? range.minProp : (isVertical ? BASE_VERTICAL_Y - COMMIT_STEP_VERTICAL : COMMIT_STEP_OFFSET_H);
        const maxP = range ? range.maxProp : (isVertical ? BASE_VERTICAL_Y - COMMIT_STEP_VERTICAL : COMMIT_STEP_OFFSET_H);
        const center = (minP + maxP) / 2;
        const clickedProp = isVertical ? position.y : position.x;
        const dist = Math.abs(clickedProp - center);
        if (dist < minDistance) {
          minDistance = dist;
          closestBranch = b;
        }
      });
      createCommitAt(closestBranch.id, position);
    } else {
      createBranchWithCommit(position);
    }
  }, [screenToFlowPosition, branches, commits, historyCurrentSequence, createCommitAt, createBranchWithCommit, layoutDirection]);

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      // Intentionally left blank, double click handled broadly by wrapper div
    },
    []
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      if (node.type === 'commit') {
        setBranchPrompt({ isOpen: true, commitId: node.id, name: '' });
      } else if (node.type === 'lane') {
        const branchId = node.id.replace('lane-', '');
        const branch = useGitStore.getState().branches[branchId];
        if (branch) {
          setRenameBranchPrompt({ isOpen: true, branchId, name: branch.name });
        }
      }
    },
    []
  );

  // Transform store data into React Flow nodes and edges
  useEffect(() => {
    const { commitList, branchList, branchRanges, branchLanes, maxLane, isVertical } = computeLayout(
      commits, branches, historyCurrentSequence, layoutDirection
    );

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // 3. Render branch lanes with precise start and end coordinates
    branchList.forEach((branch) => {
      const lane = branchLanes[branch.id];
      const range = branchRanges[branch.id];

      const minP = range ? range.minProp : (isVertical ? BASE_VERTICAL_Y - COMMIT_STEP_VERTICAL : COMMIT_STEP_OFFSET_H);
      const rangeMaxP = range ? range.maxProp : (isVertical ? BASE_VERTICAL_Y - COMMIT_STEP_VERTICAL : COMMIT_STEP_OFFSET_H);

      // Effective end of lane: commits range max, optionally extended by the
      // user via the draggable end-cap (branch.customEndPosition).
      const effectiveMaxP = branch.customEndPosition !== undefined
        ? (isVertical
            ? Math.max(rangeMaxP, branch.customEndPosition)
            : Math.max(rangeMaxP, branch.customEndPosition))
        : rangeMaxP;

      const widthOrHeight = Math.max(COMMIT_STEP_VERTICAL, effectiveMaxP - minP);
      const laneWidthOrHeight = widthOrHeight + 100;

      const laneX = isVertical ? lane * 50 + 100 : minP - 70;
      const laneY = isVertical ? minP - 70 : lane * 80 + 80;

      newNodes.push({
        id: `lane-${branch.id}`,
        type: 'lane',
        position: { x: laneX, y: laneY },
        origin: isVertical ? [0.5, 0] : [0, 0.5],
        data: {
          name: branch.name,
          color: branch.color,
          width: laneWidthOrHeight,
          isFirst: lane === 0,
          isLast: lane === maxLane,
          labelOffsetX: isVertical ? 0 : (maxLane - lane) * LANE_SPACING_HORIZONTAL + 60,
          laneIndex: lane,
          branchLabelOrientation,
        },
        draggable: branch.name !== 'main',
        selectable: branch.name !== 'main',
        zIndex: 0,
      });

      // 3b. Render draggable HEAD end-cap only when the lane is extended beyond the last commit
      if (branch.customEndPosition !== undefined) {
        const endCapPos = branch.customEndPosition;
        const endCapX = isVertical ? lane * LANE_SPACING_VERTICAL + 100 : endCapPos;
        const endCapY = isVertical ? endCapPos : lane * LANE_SPACING_HORIZONTAL + 80;

        newNodes.push({
          id: `endcap-${branch.id}`,
          type: 'endcap',
          position: { x: endCapX, y: endCapY },
          origin: [0.5, 0.5],
          data: {
            color: branch.color,
            branchName: branch.name,
          },
          draggable: true,
          selectable: false,
          zIndex: 6,
        });
      }
    });

    // 4. Render commit nodes
    const LABEL_GRID_Y = 36; // Grille verticale plus resserrée
    const LABEL_GRID_X = 150; // Espace horizontal garanti entre les étiquettes
    const baseLabelX_global = maxLane * LANE_SPACING_VERTICAL + 170;
    const placedLabels: { x: number, y: number }[] = [];

    commitList.forEach((commit, i) => {
      const branch = branches[commit.branch];
      if (!branch) return;

      const lane = branchLanes[commit.branch];

      let defaultY, defaultX, x, y;
      let labelOffsetX;
      let labelOffsetY;

      if (isVertical) {
        defaultX = lane * LANE_SPACING_VERTICAL + 100;
        defaultY = BASE_VERTICAL_Y - i * COMMIT_STEP_VERTICAL;
        x = defaultX; // locked to lane column
        y = commit.position?.y ?? defaultY; // movable in time

        let targetGlobalX = baseLabelX_global;
        // Snap to grid ignoring sequence number, just pure Y visual coordinate
        let targetGlobalY = Math.round(y / LABEL_GRID_Y) * LABEL_GRID_Y;

        let hasCollision = true;
        while (hasCollision) {
          hasCollision = placedLabels.some(
            placed => placed.x === targetGlobalX && placed.y === targetGlobalY
          );
          if (hasCollision) {
            targetGlobalX += LABEL_GRID_X; // Push label to the right (côte à côte)
          }
        }

        placedLabels.push({ x: targetGlobalX, y: targetGlobalY });

        labelOffsetX = targetGlobalX - x;
        labelOffsetY = targetGlobalY - y;
      } else {
        defaultX = i * COMMIT_STEP_HORIZONTAL + COMMIT_STEP_OFFSET_H;
        defaultY = lane * LANE_SPACING_HORIZONTAL + 80;
        x = commit.position?.x ?? defaultX; // movable in time
        y = defaultY; // locked to lane row
        labelOffsetX = 0;
        labelOffsetY = 0;
      }

      const isHead = branch.head === commit.id;
      const isMerge = commit.parents.length > 1;

      newNodes.push({
        id: commit.id,
        type: 'commit',
        position: { x, y },
        origin: [0.5, 0.5],
        draggable: true,
        zIndex: 10,
        data: {
          id: commit.id,
          message: commit.message,
          branchId: branch.id,
          branchName: branch.name,
          color: branch.color,
          isHead,
          isMerge,
          messageRotated: commit.messageRotated,
          hideId: commit.hideId !== false,
          isVertical,
          labelOffsetX,
          labelOffsetY,
        },
      });

      // Create edges (skip self-references and orphaned parents)
      commit.parents
        .filter(parentId => parentId !== commit.id && commits[parentId])
        .forEach((parentId, parentIndex) => {
        const customColor = commit.parentColors?.[parentId];
        const defaultColor = parentIndex === 0 ? branch.color : branches[commits[parentId]?.branch]?.color || '#475569';
        const strokeColor = customColor || defaultColor;

        const parentLane = branchLanes[commits[parentId]?.branch];
        const commitLane = branchLanes[commit.branch];
        const isCrossLane = parentLane !== undefined && commitLane !== undefined && parentLane !== commitLane;

        let sourceHandle: string | undefined;
        let targetHandle: string | undefined;

        if (isCrossLane && isVertical) {
          sourceHandle = parentLane < commitLane ? 'right-source' : 'left-source';
          targetHandle = parentLane < commitLane ? 'left-target' : 'right-target';
        } else if (isCrossLane && !isVertical) {
          sourceHandle = parentLane < commitLane ? 'bottom-source' : 'top-source';
          targetHandle = parentLane < commitLane ? 'top-target' : 'bottom-target';
        }

        newEdges.push({
          id: `${parentId}-${commit.id}`,
          source: parentId,
          target: commit.id,
          sourceHandle,
          targetHandle,
          type: 'gitEdge',
          zIndex: 5,
          deletable: true,
          data: { crossLane: isCrossLane, layoutVertical: isVertical },
          style: {
            stroke: strokeColor,
            strokeWidth: 3,
            opacity: 1.0,
            filter: `drop-shadow(0 1px 3px ${strokeColor}50)`,
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [commits, branches, setNodes, setEdges, layoutDirection, branchLabelOrientation]);


  const onConnect = useCallback(
    (params: any) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      if (sourceNode && targetNode) {
        // target is the child, source is the parent
        addParentToCommit(targetNode.id, sourceNode.id);
      }
    },
    [nodes, addParentToCommit],
  );

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    deletedNodes.forEach(node => {
      if (node.type === 'commit') {
        useGitStore.getState().deleteCommit(node.id);
      } else if (node.type === 'lane') {
        const branchId = node.id.replace('lane-', '');
        useGitStore.getState().deleteBranch(branchId);
      }
    });
  }, []);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(edge => {
      const parentId = edge.source;
      const childId = edge.target;
      useGitStore.getState().removeParentFromCommit(childId, parentId);
    });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setColorPrompt({ isOpen: true, edge, color: (edge.style?.stroke as string | undefined) || '' });
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const { branchId } = node.data as { branchId: string };
    if (activeBranch !== branchId) {
      setActiveBranch(branchId);
    }
  }, [activeBranch, setActiveBranch]);

  const onNodeDoubleClick = useCallback((e: React.MouseEvent, node: Node) => {
    e.stopPropagation(); // Always stop propagation to avoid multiple triggers
    if (node.type === 'commit') {
      const commit = useGitStore.getState().commits[node.id];
      if (commit) {
        setCommitPrompt({
          isOpen: true,
          commitId: node.id,
          message: commit.message,
          messageRotated: commit.messageRotated || false,
          hideId: commit.hideId || false,
        });
      }
    } else if (node.type === 'lane') {
      if ((e.target as HTMLElement).closest('.lane-label')) {
        const branchId = node.id.replace('lane-', '');
        const branch = useGitStore.getState().branches[branchId];
        if (branch) {
          setRenameBranchPrompt({ isOpen: true, branchId, name: branch.name, color: branch.color });
        }
        return;
      }
      // Double click on a lane node creates a commit on that lane
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const branchId = node.id.replace('lane-', '');
      createCommitAt(branchId, position);
    }
  }, [screenToFlowPosition, createCommitAt]);

  return (
    <div className="w-full h-full relative bg-slate-50" onDoubleClick={onDoubleClick} ref={reactFlowWrapper}>
      <div className="absolute top-4 right-4 z-10 flex gap-2 floating-tools">
        <div className="flex gap-1 mr-2 border-r border-slate-200 pr-3">
          <button
            onClick={() => undo()}
            className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Annuler (Undo)"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={() => redo()}
            className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refaire (Redo)"
          >
            <Redo className="w-5 h-5" />
          </button>
          <button
            onClick={() => setResetConfirmOpen(true)}
            className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors ml-2"
            title="Réinitialiser le dépôt"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => {
            setLayoutDirection(layoutDirection === 'horizontal' ? 'vertical' : 'horizontal');
          }}
          className="flex items-center gap-2 py-2 px-3 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-md font-bold text-sm shadow-sm transition-all border border-purple-200"
          title={layoutDirection === 'horizontal' ? "Passer en lecture verticale" : "Passer en lecture horizontale"}
        >
          {layoutDirection === 'horizontal' ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleBranchLabelOrientation}
          className="flex items-center gap-2 py-2 px-3 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md font-bold text-sm shadow-sm transition-all border border-blue-200"
          title={branchLabelOrientation === 'angled' ? "Passer les étiquettes de branches en mode vertical" : "Passer les étiquettes de branches en mode à 45°"}
        >
          <span className="w-5 h-5 flex items-center justify-center font-mono text-xs leading-none">
            {branchLabelOrientation === 'angled' ? '45°' : '90°'}
          </span>
        </button>

        <button
          onClick={handleFitViewCommits}
          className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Centrer la vue"
        >
          <Crosshair className="w-5 h-5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Importer (JSON)"
        >
          <Upload className="w-5 h-5" />
        </button>
        <button
          onClick={() => setSavePromptOpen(true)}
          className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Exporter & Sauvegarder"
        >
          <Save className="w-5 h-5" />
        </button>
        <button
          onClick={() => setHelpPromptOpen(true)}
          className="p-2 bg-white flex items-center justify-center rounded-md border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Aide & Raccourcis"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <input
          type="file"
          accept=".json"
          className="hidden"
          ref={fileInputRef}
          onChange={handleLoad}
        />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeCustom}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onEdgeContextMenu={onEdgeContextMenu}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        zoomOnDoubleClick={false}
        defaultViewport={{ x: 50, y: 50, zoom: 1 }}
        minZoom={0.2}
        snapToGrid={true}
        snapGrid={[25, 25]}
        className="bg-transparent font-sans"
      >
        <Controls className="fill-slate-700 bg-white border-slate-200" />
        <MiniMap
          zoomable
          pannable
          nodeColor={(n) => n.data?.color as string || '#cbd5e1'}
          style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
          maskColor="rgba(255, 255, 255, 0.7)"
        />
        <Background
          variant={"dots" as any}
          gap={25}
          size={1}
          color="#94a3b830"
        />

      </ReactFlow>

      {/* Branch Context Menu Dialog */}
      <Dialog isOpen={branchPrompt.isOpen} onClose={() => setBranchPrompt({ ...branchPrompt, isOpen: false })} title="Créer une branche">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Nom de la nouvelle branche</label>
            <input
              type="text"
              autoFocus
              value={branchPrompt.name}
              onChange={e => setBranchPrompt({ ...branchPrompt, name: e.target.value })}
              placeholder="ex: feature/nouvelle-fonction"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-400"
              onKeyDown={e => {
                if (e.key === 'Enter' && branchPrompt.name) {
                  createBranch(branchPrompt.name, branchPrompt.commitId);
                  setBranchPrompt({ isOpen: false, commitId: '', name: '' });
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              if (branchPrompt.name) {
                createBranch(branchPrompt.name, branchPrompt.commitId);
                setBranchPrompt({ isOpen: false, commitId: '', name: '' });
              }
            }}
            disabled={!branchPrompt.name}
            className="w-full py-2 bg-cyan-500 text-white rounded-md font-bold hover:bg-cyan-600 shadow-sm transition-colors disabled:opacity-50"
          >
            Créer la branche
          </button>
        </div>
      </Dialog>

      {/* Rename Branch Dialog */}
      <Dialog isOpen={renameBranchPrompt.isOpen} onClose={() => setRenameBranchPrompt({ ...renameBranchPrompt, isOpen: false })} title="Modifier la branche">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Nom de la branche</label>
            <input
              type="text"
              autoFocus
              value={renameBranchPrompt.name}
              onChange={e => setRenameBranchPrompt({ ...renameBranchPrompt, name: e.target.value })}
              placeholder="ex: feature/nouvelle-fonction"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-400"
              onKeyDown={e => {
                if (e.key === 'Enter' && renameBranchPrompt.name) {
                  updateBranchName(renameBranchPrompt.branchId, renameBranchPrompt.name);
                  updateBranchColor(renameBranchPrompt.branchId, renameBranchPrompt.color);
                  setRenameBranchPrompt({ isOpen: false, branchId: '', name: '', color: '' });
                }
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Couleur</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={renameBranchPrompt.color}
                onChange={e => setRenameBranchPrompt({ ...renameBranchPrompt, color: e.target.value })}
                className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent p-0"
              />
              <span className="text-sm text-slate-500 font-mono uppercase">{renameBranchPrompt.color}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (renameBranchPrompt.name) {
                updateBranchName(renameBranchPrompt.branchId, renameBranchPrompt.name);
                updateBranchColor(renameBranchPrompt.branchId, renameBranchPrompt.color);
                setRenameBranchPrompt({ isOpen: false, branchId: '', name: '', color: '' });
              }
            }}
            disabled={!renameBranchPrompt.name}
            className="w-full py-2 bg-indigo-500 text-white rounded-md font-bold hover:bg-indigo-600 shadow-sm transition-colors disabled:opacity-50 mt-2"
          >
            Enregistrer les modifications
          </button>
        </div>
      </Dialog>

      {/* Edge Context Menu Dialog */}
      <Dialog isOpen={colorPrompt.isOpen} onClose={() => setColorPrompt({ ...colorPrompt, isOpen: false })} title="Couleur du lien">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Couleur du lien (Hex)</label>
            <input
              type="text"
              autoFocus
              value={colorPrompt.color}
              onChange={e => setColorPrompt({ ...colorPrompt, color: e.target.value })}
              placeholder="#ff0000 ou vide pour réinitialiser"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-400"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (colorPrompt.edge) {
                    useGitStore.getState().updateEdgeColor(colorPrompt.edge.target, colorPrompt.edge.source, colorPrompt.color);
                  }
                  setColorPrompt({ ...colorPrompt, isOpen: false });
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              if (colorPrompt.edge) {
                useGitStore.getState().updateEdgeColor(colorPrompt.edge.target, colorPrompt.edge.source, colorPrompt.color);
              }
              setColorPrompt({ ...colorPrompt, isOpen: false });
            }}
            className="w-full py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Enregistrer la couleur
          </button>
        </div>
      </Dialog>

      {/* Edit Commit Dialog */}
      <Dialog isOpen={commitPrompt.isOpen} onClose={() => setCommitPrompt({ ...commitPrompt, isOpen: false })} title="Éditer le commit">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Message du commit</label>
            <input
              type="text"
              autoFocus
              value={commitPrompt.message}
              onChange={e => setCommitPrompt({ ...commitPrompt, message: e.target.value })}
              placeholder="Correction bug incroyable"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-400"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  useGitStore.getState().updateCommitMessage(commitPrompt.commitId, commitPrompt.message, commitPrompt.messageRotated, commitPrompt.hideId);
                  setCommitPrompt({ ...commitPrompt, isOpen: false });
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rotate-label"
                checked={commitPrompt.messageRotated}
                onChange={e => setCommitPrompt({ ...commitPrompt, messageRotated: e.target.checked })}
                className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="rotate-label" className="text-sm font-medium text-slate-700">Tourner l'étiquette à 45°</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-id"
                checked={!commitPrompt.hideId}
                onChange={e => setCommitPrompt({ ...commitPrompt, hideId: !e.target.checked })}
                className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="show-id" className="text-sm font-medium text-slate-700">Afficher le numéro de commit</label>
            </div>
          </div>
          <button
            onClick={() => {
              useGitStore.getState().updateCommitMessage(commitPrompt.commitId, commitPrompt.message, commitPrompt.messageRotated, commitPrompt.hideId);
              setCommitPrompt({ ...commitPrompt, isOpen: false });
            }}
            className="w-full py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Enregistrer le commit
          </button>
        </div>
      </Dialog>

      {/* Save / Export Dialog */}
      <Dialog isOpen={savePromptOpen} onClose={() => setSavePromptOpen(false)} title="Exporter & Sauvegarder">
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleExportImage('svg')}
            className="w-full flex items-center justify-between py-3 px-4 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Image className="w-5 h-5 text-indigo-500" /> SVG (Vectoriel)
            </span>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => handleExportImage('png')}
            className="w-full flex items-center justify-between py-3 px-4 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Image className="w-5 h-5 text-indigo-500" /> PNG (Raster)
            </span>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between py-3 px-4 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-500" /> JSON (Sauvegarde Data)
            </span>
            <Download className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog isOpen={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} title="Réinitialiser le dépôt">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Toutes les branches et commits seront supprimés. Cette action est irréversible.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setResetConfirmOpen(false)}
              className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-md font-medium hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => { resetStore(); setResetConfirmOpen(false); }}
              className="flex-1 py-2 bg-red-500 text-white rounded-md font-bold hover:bg-red-600 shadow-sm transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </Dialog>

      {/* Load Error Dialog */}
      <Dialog isOpen={loadErrorOpen} onClose={() => setLoadErrorOpen(false)} title="Erreur d'import">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Le fichier sélectionné n'est pas un JSON valide ou son format est incompatible.</p>
          <button
            onClick={() => setLoadErrorOpen(false)}
            className="w-full py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            OK
          </button>
        </div>
      </Dialog>

      {/* Help Dialog */}
      <Dialog isOpen={helpPromptOpen} onClose={() => setHelpPromptOpen(false)} title="Aide & Raccourcis">
        <div className="flex flex-col gap-4 text-sm text-slate-600">
          <p>Cet éditeur minimaliste GitGraph vous permet de tracer vos dépôts facilement.</p>
          <ul className="space-y-2 list-disc list-inside bg-slate-50 p-4 rounded-md border border-slate-200">
            <li><strong>Double-clic dans le vide</strong> : Créer une nouvelle branche et un commit.</li>
            <li><strong>Double-clic sur le début d'une branche (ligne de vie)</strong> : Créer un commit sur cette branche.</li>
            <li><strong>Double-clic sur un commit</strong> : Modifier le message et l'orientation de l'étiquette.</li>
            <li><strong>Clic-droit sur un commit</strong> : Créer une nouvelle branche à partir de ce commit.</li>
            <li><strong>Clic-droit sur l'étiquette d'une branche</strong> : Renommer la branche.</li>
            <li><strong>Glisser-déposer de l'étiquette d'une branche</strong> : Déplacer la branche (réordonner les lignes).</li>
            <li><strong>Supprimer une branche</strong> : Cliquez sur l'icône de corbeille (🗑️) sur son étiquette ou sélectionnez l'étiquette et appuyez sur la touche <kbd className="px-1.5 py-0.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-md shadow-sm">Suppr</kbd> / <kbd className="px-1.5 py-0.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-md shadow-sm">Retour arrière</kbd>.</li>
            <li><strong>Glisser-déposer d'un commit à un autre</strong> : Ajouter un parent (fusion ou lien de validation).</li>
            <li><strong>Clic-gauche sur un lien/flèche</strong> : Changer la couleur du lien.</li>
          </ul>
        </div>
      </Dialog>

    </div>
  );
}

export default function GitGraph() {
  return (
    <ReactFlowProvider>
      <GitGraphInner />
    </ReactFlowProvider>
  );
}
