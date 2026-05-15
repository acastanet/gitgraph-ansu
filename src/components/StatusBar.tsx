import { useGitStore } from "../store/useGitStore";

export default function StatusBar() {
  const { commits, branches, activeBranch } = useGitStore();
  
  const commitCount = Object.keys(commits).length;
  const branchCount = Object.keys(branches).length;

  return (
    <div className="h-8 bg-slate-100 border-t border-slate-200 flex items-center justify-between px-4 shrink-0 text-[10px] text-slate-500 font-medium z-10 relative uppercase tracking-widest">
      <div className="flex gap-4">
        <span>{commitCount} commits</span>
        <span>{branchCount} branches</span>
      </div>
      <div>
        HEAD → <span className="text-indigo-600 font-bold">{activeBranch ? branches[activeBranch].name : 'none'}</span>
      </div>
    </div>
  );
}
