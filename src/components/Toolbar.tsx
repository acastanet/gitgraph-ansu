import React, { useState, useRef } from 'react';
import { useGitStore } from '../store/useGitStore';
import { Plus, GitMerge, GitBranch, Save, Upload, RotateCcw, Play, LayoutGrid, List } from 'lucide-react';
import { Dialog } from './Dialog';

export default function Toolbar() {
  const [isCommitOpen, setIsCommitOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [branchName, setBranchName] = useState('');

  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    createCommit, 
    createBranch, 
    mergeBranches, 
    getSavedGraph, 
    loadGraph, 
    reset,
    activeBranch,
    branches,
    layoutDirection,
    setLayoutDirection
  } = useGitStore(state => state);

  const handleCreateCommit = () => {
    createCommit(commitMsg);
    setCommitMsg('');
    setIsCommitOpen(false);
  };

  const handleCreateBranch = () => {
    if (!branchName) return;
    const currentHead = activeBranch ? branches[activeBranch].head : null;
    if (currentHead) {
      createBranch(branchName, currentHead);
    }
    setBranchName('');
    setIsBranchOpen(false);
  };

  const handleMerge = () => {
    if (mergeSource && activeBranch) {
      mergeBranches(mergeSource, activeBranch);
    }
    setMergeSource('');
    setIsMergeOpen(false);
  };

  const handleSave = () => {
    const data = getSavedGraph();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'git-graph-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          loadGraph(JSON.parse(content));
        } catch (err) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  const activeBranchName = activeBranch ? branches[activeBranch]?.name : 'None';
  const otherBranches = Object.values(branches).filter(b => b.id !== activeBranch);

  return (
    <div className="min-h-16 py-3 gap-y-3 gap-x-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between px-4 shrink-0 relative z-40 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center shrink-0">
          <GitBranch className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight uppercase text-slate-800 shrink-0 hidden md:block">
          GitGraph
        </h1>
        <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>
        <button 
          onClick={() => setIsCommitOpen(true)}
          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors border border-slate-200 flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Commit</span>
        </button>
        <button 
          onClick={() => setIsBranchOpen(true)}
          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors border border-slate-200 flex items-center gap-1.5 shadow-sm"
        >
          <GitBranch className="w-4 h-4" /> <span className="hidden sm:inline">Branch</span>
        </button>
        <button 
          onClick={() => setIsMergeOpen(true)}
          className="px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md text-sm font-bold transition-colors shadow-sm flex items-center gap-1.5"
        >
          <GitMerge className="w-4 h-4" /> <span className="hidden sm:inline">Merge</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[10px] uppercase tracking-widest font-medium text-slate-500 mr-2 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          HEAD: <span className="text-indigo-600 font-bold">{activeBranchName}</span>
        </div>
        <button 
          onClick={handleSave}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" 
          title="Save JSON"
        >
          <Save className="w-5 h-5" />
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" 
          title="Load JSON"
        >
          <Upload className="w-5 h-5" />
        </button>
        <input 
          type="file" 
          accept=".json" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleLoad} 
        />
        <div className="h-6 w-px bg-slate-200 mx-1"></div>
        <button 
          onClick={() => {
            const totalCommits = Object.keys(useGitStore.getState().commits).length;
            if (totalCommits === 0) return;
            
            let seq = 1;
            useGitStore.getState().setHistorySequence(seq);
            const interval = setInterval(() => {
              seq++;
              if (seq > totalCommits) {
                clearInterval(interval);
                useGitStore.getState().setHistorySequence(null);
              } else {
                useGitStore.getState().setHistorySequence(seq);
              }
            }, 600); // 600ms per commit step
          }}
          className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded-md font-bold text-sm shadow-md hover:bg-indigo-700 transition-all ml-1"
          title="Play History"
        >
          <Play className="w-4 h-4" fill="currentColor" /> Play
        </button>
        <button 
          onClick={() => {
            reset();
          }}
          className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-md ml-1 transition-colors" 
          title="Reset Graph"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Commit Dialog */}
      <Dialog isOpen={isCommitOpen} onClose={() => setIsCommitOpen(false)} title="New Commit">
        <div className="flex flex-col gap-4">
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Commit Message</label>
             <input 
               type="text" 
               autoFocus
               value={commitMsg}
               onChange={e => setCommitMsg(e.target.value)}
               placeholder="Fix important bug"
               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-400"
               onKeyDown={e => e.key === 'Enter' && handleCreateCommit()}
             />
          </div>
          <button 
            onClick={handleCreateCommit}
            className="w-full py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Create Commit
          </button>
        </div>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog isOpen={isBranchOpen} onClose={() => setIsBranchOpen(false)} title="Create Branch">
        <div className="flex flex-col gap-4">
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Branch Name</label>
             <input 
               type="text" 
               autoFocus
               value={branchName}
               onChange={e => setBranchName(e.target.value)}
               placeholder="A"
               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-slate-400"
               onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
             />
          </div>
          <button 
            onClick={handleCreateBranch}
            className="w-full py-2 bg-cyan-500 text-white rounded-md font-bold hover:bg-cyan-600 shadow-sm transition-colors"
          >
            Create Branch
          </button>
        </div>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog isOpen={isMergeOpen} onClose={() => setIsMergeOpen(false)} title="Merge Branches">
        <div className="flex flex-col gap-4">
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1 uppercase tracking-wider">Merge FROM</label>
             <select 
               value={mergeSource}
               onChange={e => setMergeSource(e.target.value)}
               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
             >
               <option value="" disabled>Select branch to merge...</option>
               {otherBranches.map(b => (
                 <option key={b.id} value={b.id}>{b.name}</option>
               ))}
             </select>
          </div>
          <div className="p-3 bg-slate-50 text-sm text-slate-600 border border-slate-200 rounded-md">
            INTO currently active: <span className="font-bold text-indigo-600">{activeBranchName}</span>
          </div>
          <button 
            onClick={handleMerge}
            disabled={!mergeSource}
            className="w-full py-2 bg-emerald-500 text-white rounded-md font-bold hover:bg-emerald-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Merge
          </button>
        </div>
      </Dialog>

    </div>
  );
}
