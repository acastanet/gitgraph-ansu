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
import { Save, Download, Crosshair, Upload, HelpCircle, FileJson, Image, FileCode2, Undo, Redo, RefreshCcw } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import CommitNode from './CommitNode';
import LaneNode from './LaneNode';
import { Dialog } from './Dialog';

const nodeTypes = {
  commit: CommitNode,
  lane: LaneNode,
};

function GitGraphInner() {
  const { commits, branches, mergeBranches, activeBranch, setActiveBranch, historyCurrentSequence, updateCommitPosition, addParentToCommit, createCommitAt, createBranchWithCommit, createBranch, updateBranchName } = useGitStore(state => state);
  const resetStore = useGitStore(state => state.reset);
  const { undo, redo } = useGitStore.temporal.getState();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [branchPrompt, setBranchPrompt] = useState<{isOpen: boolean, commitId: string, name: string}>({isOpen: false, commitId: '', name: ''});
  const [renameBranchPrompt, setRenameBranchPrompt] = useState<{isOpen: boolean, branchId: string, name: string}>({isOpen: false, branchId: '', name: ''});
  const [colorPrompt, setColorPrompt] = useState<{isOpen: boolean, edge: Edge | null, color: string}>({isOpen: false, edge: null, color: ''});
  const [commitPrompt, setCommitPrompt] = useState<{isOpen: boolean, commitId: string, message: string, messageRotated: boolean}>({isOpen: false, commitId: '', message: '', messageRotated: false});
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
    // Lock Y axis when dragging so they stay on their lane
    const modifiedChanges = changes.map(c => {
      if (c.type === 'position' && c.position) {
        const node = nodes.find(n => n.id === c.id);
        if (node) {
          return {
            ...c,
            position: { x: c.position.x, y: node.position.y }
          };
        }
      }
      return c;
    });
    onNodesChange(modifiedChanges);
  }, [nodes, onNodesChange]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    console.log("GitGraph: onNodeDragStop", node);
    if (node.type === 'commit') {
      updateCommitPosition(node.id, { x: node.position.x, y: node.position.y });
    }
  }, [updateCommitPosition]);

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

    // Determine target branch lane
    // Each lane is at y = index * 150 + 100
    // So index is roughly (y - 100) / 150.
    // If we click exactly on y=250, it is 150 above 100, which is lane 1.
    // Let's broaden the hit area so half above and half below snaps to the nearest lane.
    const branchIndex = Math.max(0, Math.round((position.y - 100) / 150));
    
    if (branchIndex < branchList.length) {
      const targetBranch = branchList[branchIndex];
      createCommitAt(targetBranch.id, position);
    } else {
      createBranchWithCommit(position);
    }
  }, [screenToFlowPosition, branches, createCommitAt, createBranchWithCommit]);

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
    
    // Create a mapping from branch ID to an X coordinate lane
    // stable sorting of branch list based on something. Let's just use array index for now.
    const branchLanes: Record<string, number> = {};
    branchList.forEach((b, index) => {
      branchLanes[b.id] = index;
    });

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let maxCommitX = 0;
    commitList.forEach((commit, i) => {
      const defaultX = i * 250 + 150;
      const x = commit.position?.x ?? defaultX;
      if (x > maxCommitX) maxCommitX = x;
    });

    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const graphWidth = Math.max(windowWidth, maxCommitX + 300);

    branchList.forEach((branch, index) => {
      newNodes.push({
        id: `lane-${branch.id}`,
        type: 'lane',
        position: { x: 0, y: index * 150 + 100 },
        origin: [0, 0.5],
        data: {
          name: branch.name,
          color: branch.color,
          width: graphWidth,
          isFirst: index === 0,
          isLast: index === branchList.length - 1,
        },
        draggable: false,
        selectable: false,
        zIndex: 0, 
      });
    });

    commitList.forEach((commit, i) => {
      const branch = branches[commit.branch];
      if (!branch) return;

      const lane = branchLanes[commit.branch];
      const defaultY = lane * 150 + 100;
      const defaultX = i * 250 + 150;
      
      const isHead = branch.head === commit.id;
      const isMerge = commit.parents.length > 1;

      newNodes.push({
        id: commit.id,
        type: 'commit',
        position: { 
          x: commit.position?.x ?? defaultX, // x comes from store if dragged, or default
          y: defaultY // y is always locked to the branch lane
        }, 
        origin: [0.5, 0.5],
        draggable: true, // Allow draggable
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
  }, [commits, branches, setNodes, setEdges]);


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
          messageRotated: commit.messageRotated || false 
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
                  useGitStore.getState().updateCommitMessage(commitPrompt.commitId, commitPrompt.message, commitPrompt.messageRotated);
                  setCommitPrompt({ ...commitPrompt, isOpen: false });
                }
              }}
            />
          </div>
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
          <button 
            onClick={() => {
              useGitStore.getState().updateCommitMessage(commitPrompt.commitId, commitPrompt.message, commitPrompt.messageRotated);
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
