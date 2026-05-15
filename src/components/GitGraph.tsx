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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGitStore } from '../store/useGitStore';
import CommitNode from './CommitNode';
import LaneNode from './LaneNode';
import { Dialog } from './Dialog';

const nodeTypes = {
  commit: CommitNode,
  lane: LaneNode,
};

function GitGraphInner() {
  const { commits, branches, mergeBranches, activeBranch, setActiveBranch, historyCurrentSequence, updateCommitPosition, addParentToCommit, createCommitAt, createBranch } = useGitStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();

  const [branchPrompt, setBranchPrompt] = useState<{isOpen: boolean, commitId: string, name: string}>({isOpen: false, commitId: '', name: ''});
  const [colorPrompt, setColorPrompt] = useState<{isOpen: boolean, edge: Edge | null, color: string}>({isOpen: false, edge: null, color: ''});
  const [commitPrompt, setCommitPrompt] = useState<{isOpen: boolean, commitId: string, message: string, messageRotated: boolean}>({isOpen: false, commitId: '', message: '', messageRotated: false});

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
    const targetBranch = branchList[Math.min(branchIndex, branchList.length - 1)];

    if (targetBranch) {
      createCommitAt(targetBranch.id, position);
    }
  }, [screenToFlowPosition, branches, createCommitAt]);

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

    const graphWidth = Math.max(3000, commitList.length * 250 + 500);

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
      // Double click on a lane node creates a commit on that lane
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const branchId = node.id.replace('lane-', '');
      createCommitAt(branchId, position);
    }
  }, [screenToFlowPosition, createCommitAt]);

  return (
    <div className="w-full h-full relative bg-slate-50" onDoubleClick={onDoubleClick}>
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
        <Background gap={32} size={1} color="#cbd5e1" />
      </ReactFlow>

      {/* Branch Context Menu Dialog */}
      <Dialog isOpen={branchPrompt.isOpen} onClose={() => setBranchPrompt({ ...branchPrompt, isOpen: false })} title="Create Branch">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">New Branch Name</label>
            <input 
              type="text" 
              autoFocus
              value={branchPrompt.name}
              onChange={e => setBranchPrompt({ ...branchPrompt, name: e.target.value })}
              placeholder="feature/new-branch"
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
            Create Branch
          </button>
        </div>
      </Dialog>

      {/* Edge Context Menu Dialog */}
      <Dialog isOpen={colorPrompt.isOpen} onClose={() => setColorPrompt({ ...colorPrompt, isOpen: false })} title="Change Link Color">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Link Color (Hex)</label>
            <input 
              type="text" 
              autoFocus
              value={colorPrompt.color}
              onChange={e => setColorPrompt({ ...colorPrompt, color: e.target.value })}
              placeholder="#ff0000 or empty to reset"
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
            Save Color
          </button>
        </div>
      </Dialog>

      {/* Edit Commit Dialog */}
      <Dialog isOpen={commitPrompt.isOpen} onClose={() => setCommitPrompt({ ...commitPrompt, isOpen: false })} title="Edit Commit">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Commit Message</label>
            <input 
              type="text" 
              autoFocus
              value={commitPrompt.message}
              onChange={e => setCommitPrompt({ ...commitPrompt, message: e.target.value })}
              placeholder="Fix amazing bug"
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
            <label htmlFor="rotate-label" className="text-sm font-medium text-slate-700">Rotate label 45°</label>
          </div>
          <button 
            onClick={() => {
              useGitStore.getState().updateCommitMessage(commitPrompt.commitId, commitPrompt.message, commitPrompt.messageRotated);
              setCommitPrompt({ ...commitPrompt, isOpen: false });
            }}
            className="w-full py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Save Commit
          </button>
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
