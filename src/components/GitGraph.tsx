import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
import { Save, Download, Crosshair, Upload, HelpCircle, FileJson, Image, FileCode2, Undo, Redo, RefreshCcw, LayoutGrid, List } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import CommitNode from './CommitNode';
import LaneNode from './LaneNode';
import { Dialog } from './Dialog';

const nodeTypes = {
  commit: CommitNode,
  lane: LaneNode,
};

function GitGraphInner() {
  const { commits, branches, mergeBranches, activeBranch, setActiveBranch, historyCurrentSequence, updateCommitPosition, addParentToCommit, createCommitAt, createBranchWithCommit, createBranch, updateBranchName, layoutDirection, setLayoutDirection } = useGitStore(state => state);
  const resetStore = useGitStore(state => state.reset);
  const { undo, redo } = useGitStore.temporal.getState();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [branchPrompt, setBranchPrompt] = useState<{isOpen: boolean, commitId: string, name: string}>({isOpen: false, commitId: '', name: ''});
  const [renameBranchPrompt, setRenameBranchPrompt] = useState<{isOpen: boolean, branchId: string, name: string}>({isOpen: false, branchId: '', name: ''});
  const [colorPrompt, setColorPrompt] = useState<{isOpen: boolean, edge: Edge | null, color: string}>({isOpen: false, edge: null, color: ''});
  const [commitPrompt, setCommitPrompt] = useState<{isOpen: boolean, commitId: string, message: string, messageRotated: boolean, hideId: boolean}>({isOpen: false, commitId: '', message: '', messageRotated: false, hideId: false});
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [helpPromptOpen, setHelpPromptOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSVG = useCallback(() => {
    setSavePromptOpen(false);
    setTimeout(() => {
      const nodes = getNodes();
      // If there are no nodes, just export the viewport
      if (nodes.length === 0) return;

      const nodesBounds = getNodesBounds(nodes);
      const width = nodesBounds.width + 100; // Add some padding
      const height = nodesBounds.height + 100;
      
      const transform = getViewportForBounds(
        nodesBounds,
        width,
        height,
        0.1,
        2,
        0
      );

      const el = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!el) return;
      
      toSvg(el, {
        backgroundColor: '#f8fafc',
        width,
        height,
        style: {
          width: width.toString(),
          height: height.toString(),
          transform: `translate(${transform.x + 50}px, ${transform.y + 50}px) scale(${transform.zoom})`,
        },
      }).then((dataUrl) => {
        const a = document.createElement('a');
        a.setAttribute('download', 'git-graph.svg');
        a.setAttribute('href', dataUrl);
        a.click();
      }).catch((err) => {
        console.error('Failed to export SVG', err);
      });
    }, 200);
  }, [getNodes]);

  const handleExportPNG = useCallback(() => {
    setSavePromptOpen(false);
    setTimeout(() => {
      const nodes = getNodes();
      if (nodes.length === 0) return;

      const nodesBounds = getNodesBounds(nodes);
      const width = nodesBounds.width + 100;
      const height = nodesBounds.height + 100;
      
      const transform = getViewportForBounds(
        nodesBounds,
        width,
        height,
        0.1,
        2,
        0
      );

      const el = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!el) return;

      toPng(el, {
        backgroundColor: '#f8fafc',
        width,
        height,
        style: {
          width: width.toString(),
          height: height.toString(),
          transform: `translate(${transform.x + 50}px, ${transform.y + 50}px) scale(${transform.zoom})`,
        },
      }).then((dataUrl) => {
        const a = document.createElement('a');
        a.setAttribute('download', 'git-graph.png');
        a.setAttribute('href', dataUrl);
        a.click();
      }).catch((err) => {
        console.error('Failed to export PNG', err);
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
          alert("Invalid JSON file");
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
    console.log("GitGraph: onNodeDragStop", node);
    if (node.type === 'commit') {
      updateCommitPosition(node.id, { x: node.position.x, y: node.position.y });
    } else if (node.type === 'lane') {
      const branchId = node.id.replace('lane-', '');
      const isVertical = layoutDirection === 'vertical';
      const targetLane = isVertical
        ? Math.max(0, Math.round((node.position.x - 100) / 90))
        : Math.max(0, Math.round((node.position.y - 80) / 80));
      useGitStore.getState().setBranchLaneIndex(branchId, targetLane);
    }
  }, [updateCommitPosition, layoutDirection]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.react-flow__node-commit')) {
      return; // Ignore double clicks on commit nodes
    }
    
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    
    const branchList = Object.values(branches).sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      if (a.name === 'main') return -1;
      if (b.name === 'main') return 1;
      return a.name.localeCompare(b.name);
    });

    const isVertical = layoutDirection === 'vertical';
    const clickedLane = isVertical
      ? Math.max(0, Math.round((position.x - 100) / 90))
      : Math.max(0, Math.round((position.y - 80) / 80));

    // Calculate branchRanges using commits
    let commitList = Object.values(commits).sort((a, b) => a.timestamp - b.timestamp);
    if (historyCurrentSequence !== null) {
      commitList = commitList.slice(0, historyCurrentSequence);
    }
    const branchRanges: Record<string, { minProp: number, maxProp: number }> = {};
    const baseVerticalY = 800;
    
    commitList.forEach((commit, i) => {
      let progression: number;
      if (isVertical) {
        progression = commit.position?.y ?? (baseVerticalY - i * 150);
      } else {
        progression = commit.position?.x ?? (i * 250 + 150);
      }
      if (!branchRanges[commit.branch]) {
        branchRanges[commit.branch] = { minProp: progression, maxProp: progression };
      } else {
        branchRanges[commit.branch].minProp = Math.min(branchRanges[commit.branch].minProp, progression);
        branchRanges[commit.branch].maxProp = Math.max(branchRanges[commit.branch].maxProp, progression);
      }
    });

    // Mapped branches to lanes (manual alignment, not automatic!)
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

    const targetBranches = branchList.filter(b => branchLanes[b.id] === clickedLane);
    
    if (targetBranches.length > 0) {
      // Find the branch whose range is closest to the click coordinate
      let closestBranch = targetBranches[0];
      let minDistance = Infinity;
      targetBranches.forEach(b => {
        const range = branchRanges[b.id];
        const minP = range ? range.minProp : (isVertical ? baseVerticalY - 150 : 150);
        const maxP = range ? range.maxProp : (isVertical ? baseVerticalY - 150 : 150);
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
      console.log("GitGraph: onNodeContextMenu", node);
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

    const isVertical = layoutDirection === 'vertical';
    const baseVerticalY = 800; // Baseline for vertical 

    // 1. Calculate branchRanges using commits
    let maxCommitProgression = 0;
    const branchRanges: Record<string, { minProp: number, maxProp: number }> = {};

    commitList.forEach((commit, i) => {
      let progression: number;
      if (isVertical) {
        const defaultY = baseVerticalY - i * 150;
        const y = commit.position?.y ?? defaultY;
        progression = y;
        if (baseVerticalY - y > maxCommitProgression) maxCommitProgression = baseVerticalY - y;
      } else {
        const defaultX = i * 250 + 150;
        const x = commit.position?.x ?? defaultX;
        progression = x;
        if (x > maxCommitProgression) maxCommitProgression = x;
      }

      if (!branchRanges[commit.branch]) {
        branchRanges[commit.branch] = { minProp: progression, maxProp: progression };
      } else {
        branchRanges[commit.branch].minProp = Math.min(branchRanges[commit.branch].minProp, progression);
        branchRanges[commit.branch].maxProp = Math.max(branchRanges[commit.branch].maxProp, progression);
      }
    });

    // 2. Assign branches to lanes (columns/rows) - manual alignment, not automatic!
    // LANE_SPACING_VERTICAL = 90 (narrow/tight lane spacing)
    // LANE_SPACING_HORIZONTAL = 80 (tight horizontal spacing)
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

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // 3. Render branch lanes with precise start and end coordinates
    branchList.forEach((branch) => {
      const lane = branchLanes[branch.id];
      const range = branchRanges[branch.id];
      
      const minP = range ? range.minProp : (isVertical ? baseVerticalY - 150 : 150);
      const maxP = range ? range.maxProp : (isVertical ? baseVerticalY - 150 : 150);
      
      const widthOrHeight = Math.max(150, maxP - minP);
      // Lane line matches the branch's active range precisely
      const laneWidthOrHeight = isVertical 
        ? (range ? Math.max(150, range.maxProp - range.minProp) + 100 : 150)
        : widthOrHeight + 100;

      const laneX = isVertical ? lane * 90 + 100 : minP - 70;
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
          labelOffsetX: isVertical ? 0 : (maxLane - lane) * 80 + 60,
        },
        draggable: branch.name !== 'main',
        selectable: false,
        zIndex: 0, 
      });
    });

    // 4. Render commit nodes
    commitList.forEach((commit, i) => {
      const branch = branches[commit.branch];
      if (!branch) return;

      const lane = branchLanes[commit.branch];
      
      let defaultY, defaultX, x, y;
      let labelOffsetX;
      if (isVertical) {
        defaultX = lane * 90 + 100;
        defaultY = baseVerticalY - i * 150;
        x = defaultX; // locked to lane column
        y = commit.position?.y ?? defaultY; // movable in time
        labelOffsetX = (maxLane - lane) * 90 + 60;
      } else {
        defaultX = i * 250 + 150;
        defaultY = lane * 80 + 80;
        x = commit.position?.x ?? defaultX; // movable in time
        y = defaultY; // locked to lane row
        labelOffsetX = 0;
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
          hideId: commit.hideId,
          isVertical,
          labelOffsetX,
        },
      });

      // Create edges
      commit.parents.forEach((parentId, parentIndex) => {
        const customColor = commit.parentColors?.[parentId];
        const defaultColor = parentIndex === 0 ? branch.color : branches[commits[parentId]?.branch]?.color || '#475569';
        const strokeColor = customColor || defaultColor;

        newEdges.push({
          id: `${parentId}-${commit.id}`,
          source: parentId, // Parent Commit
          target: commit.id, // Current Commit
          type: 'default', // default is bezier
          zIndex: 5,
          deletable: true,
          style: {
            stroke: strokeColor,
            strokeWidth: 3,
            opacity: 0.8,
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [commits, branches, setNodes, setEdges, layoutDirection]);


  const onConnect = useCallback(
    (params: any) => {
       console.log("GitGraph: onConnect", params);
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
    console.log("GitGraph: onNodesDelete", deletedNodes);
    deletedNodes.forEach(node => {
      if (node.type === 'commit') {
        useGitStore.getState().deleteCommit(node.id);
      }
    });
  }, []);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    console.log("GitGraph: onEdgesDelete", deletedEdges);
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
    console.log("GitGraph: onNodeClick", node);
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
          setRenameBranchPrompt({ isOpen: true, branchId, name: branch.name });
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
            onClick={() => {
              resetStore();
            }}
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
      <Dialog isOpen={renameBranchPrompt.isOpen} onClose={() => setRenameBranchPrompt({ ...renameBranchPrompt, isOpen: false })} title="Renommer la branche">
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
                  setRenameBranchPrompt({ isOpen: false, branchId: '', name: '' });
                }
              }}
            />
          </div>

          {/* Column/Lane position managed visually via Drag & Drop on the head circle */}

          <button 
            onClick={() => {
              if (renameBranchPrompt.name) {
                updateBranchName(renameBranchPrompt.branchId, renameBranchPrompt.name);
                setRenameBranchPrompt({ isOpen: false, branchId: '', name: '' });
              }
            }}
            disabled={!renameBranchPrompt.name}
            className="w-full py-2 bg-cyan-500 text-white rounded-md font-bold hover:bg-cyan-600 shadow-sm transition-colors disabled:opacity-50"
          >
            Renommer la branche
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
            onClick={handleExportSVG}
            className="w-full flex items-center justify-between py-3 px-4 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Image className="w-5 h-5 text-indigo-500" /> SVG (Vectoriel)
            </span>
            <Download className="w-4 h-4 text-slate-400" />
          </button>
          
          <button 
            onClick={handleExportPNG}
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

      {/* Help Dialog */}
      <Dialog isOpen={helpPromptOpen} onClose={() => setHelpPromptOpen(false)} title="Aide & Raccourcis">
        <div className="flex flex-col gap-4 text-sm text-slate-600">
          <p>Cet éditeur minimaliste GitGraph vous permet de tracer vos dépôts facilement.</p>
          <ul className="space-y-2 list-disc list-inside bg-slate-50 p-4 rounded-md border border-slate-200">
            <li><strong>Double-clic dans le vide</strong> : Créer une nouvelle branche et un commit.</li>
            <li><strong>Double-clic sur le début d'une branche (ligne de vie)</strong> : Créer un commit sur cette branche.</li>
            <li><strong>Double-clic sur un commit</strong> : Modifier le message et l'orientation de l'étiquette.</li>
            <li><strong>Clic-droit sur un commit</strong> : Créer une nouvelle branche à partir de ce commit.</li>
            <li><strong>Clic-droit sur le début d'une branche</strong> : Renommer la branche.</li>
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
