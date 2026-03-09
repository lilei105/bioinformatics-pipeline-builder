import { CheckCircle2, GitBranch, Package, Play, ArrowRight } from 'lucide-react';
import type { PipelineStep } from '../types';

interface Props {
  steps: PipelineStep[];
  startTypes: string[];
  goalTypes: string[];
}

export default function ResultPanel({ steps, startTypes, goalTypes }: Props) {
  const toolCount = steps.filter((s) => s.type === 'tool').length;
  const branchCount = steps.filter((s) => s.type === 'branch').length;
  const aggregateCount = steps.filter((s) => s.type === 'aggregate').length;

  return (
    <div className="p-5">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBadge icon={<Play size={13} />} value={toolCount} label="工具步骤" color="blue" />
        <StatBadge icon={<GitBranch size={13} />} value={branchCount} label="并行分支" color="pink" />
        <StatBadge icon={<Package size={13} />} value={aggregateCount} label="聚合步骤" color="amber" />
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 text-xs truncate max-w-[130px]">
          {startTypes[0] || '-'}
        </span>
        <ArrowRight size={12} className="shrink-0 text-slate-400" />
        <span className="flex items-center gap-1 font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-700 text-xs truncate max-w-[130px]">
          {goalTypes[0] || '-'}
        </span>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {steps.map((step, i) => (
          <StepRow key={i} step={step} index={i + 1} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
        <CheckCircle2 size={13} />
        <span>工作流规划完成，共 {steps.length} 个步骤</span>
      </div>
    </div>
  );
}

function StatBadge({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: 'blue' | 'pink' | 'amber';
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-600',
    pink: 'bg-pink-50 text-pink-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className={`rounded-xl p-2.5 text-center ${styles[color]}`}>
      <div className="flex items-center justify-center mb-1 opacity-70">{icon}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-xs mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

function StepRow({ step, index }: { step: PipelineStep; index: number }) {
  if (step.type === 'tool') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
        <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
          {index}
        </span>
        <span className="text-xs font-mono text-blue-800 font-medium">{step.tool_id}</span>
        <span className="ml-auto text-xs text-blue-400 bg-blue-100 px-1.5 py-0.5 rounded">tool</span>
      </div>
    );
  }

  if (step.type === 'branch') {
    return (
      <div className="px-2.5 py-1.5 rounded-lg bg-pink-50 border border-pink-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-5 rounded-full bg-pink-200 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0">
            {index}
          </span>
          <GitBranch size={12} className="text-pink-500" />
          <span className="text-xs text-pink-700 font-medium">并行分支 ({step.branches.length} 路)</span>
        </div>
        <div className="ml-7 space-y-0.5">
          {step.branches.map((branch, bi) => (
            <div key={bi} className="flex items-center gap-1 text-xs text-pink-600">
              <span className="text-pink-400">└</span>
              <span className="font-mono">{branch.join(' → ')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
      <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
        {index}
      </span>
      <Package size={12} className="text-amber-500" />
      <span className="text-xs font-mono text-amber-800 font-medium truncate">{step.display}</span>
    </div>
  );
}
