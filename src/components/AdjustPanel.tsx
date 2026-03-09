import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Send, RotateCcw, Plus, Minus, RefreshCw, ArrowUpDown } from 'lucide-react';
import type { AdjustRecord, WorkflowStatus } from '../types';

const ACTION_LABELS: Record<AdjustRecord['action'], { label: string; color: string; Icon: typeof Plus }> = {
  replan: { label: '完整重新规划', color: 'text-blue-600 bg-blue-50 border-blue-200', Icon: RefreshCw },
  add_goal: { label: '追加目标', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', Icon: Plus },
  remove_step: { label: '移除步骤', color: 'text-rose-600 bg-rose-50 border-rose-200', Icon: Minus },
  update_start: { label: '更新起始数据', color: 'text-amber-600 bg-amber-50 border-amber-200', Icon: RotateCcw },
  reorder: { label: '调整步骤顺序', color: 'text-sky-600 bg-sky-50 border-sky-200', Icon: ArrowUpDown },
};

const EXAMPLES = [
  '我已经有了clean reads，跳过质控步骤',
  '去掉 BLAST 比对步骤',
  '在现有流程上再加一个 PCA 分析',
  '换成从双端原始序列开始分析',
];

interface Props {
  status: WorkflowStatus;
  adjustHistory: AdjustRecord[];
  originalIntent: string;
  onAdjust: (input: string) => void;
}

export default function AdjustPanel({ status, adjustHistory, originalIntent, onAdjust }: Props) {
  const [input, setInput] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);

  const isAdjusting = status === 'adjusting' || status === 'planning';
  const canAdjust = status === 'completed' || status === 'adjusting';

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adjustHistory]);

  const handleSubmit = () => {
    if (!input.trim() || isAdjusting) return;
    onAdjust(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
          <SlidersHorizontal size={16} className="text-teal-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">调整流程</h2>
          <p className="text-xs text-slate-500 mt-0.5">用自然语言告诉我需要如何修改当前的分析流程</p>
        </div>
      </div>

      {adjustHistory.length > 0 && (
        <div className="px-4 pb-2 flex flex-col gap-2 max-h-40 overflow-y-auto">
          <div className="flex items-start gap-2">
            <div className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 max-w-[85%] leading-relaxed">
              <span className="text-slate-400 text-[10px] block mb-0.5">原始需求</span>
              {originalIntent}
            </div>
          </div>
          {adjustHistory.map((record, i) => {
            const cfg = ACTION_LABELS[record.action];
            const Icon = cfg.Icon;
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-end">
                  <div className="text-xs px-2.5 py-1.5 rounded-xl bg-teal-600 text-white max-w-[85%] leading-relaxed">
                    {record.input}
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <div className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-medium ${cfg.color}`}>
                    <Icon size={10} />
                    {cfg.label}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5 flex-1">{record.reasoning}</p>
                </div>
              </div>
            );
          })}
          <div ref={historyEndRef} />
        </div>
      )}

      <div className="px-4 pb-2 mt-auto">
        {adjustHistory.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                disabled={isAdjusting || !canAdjust}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed truncate max-w-[200px]"
                title={ex}
              >
                {ex.length > 18 ? ex.slice(0, 18) + '…' : ex}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想如何调整这个流程..."
            disabled={isAdjusting || !canAdjust}
            rows={2}
            className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isAdjusting || !canAdjust}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            title="发送调整 (Ctrl+Enter)"
          >
            {isAdjusting ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>

        {input && !isAdjusting && canAdjust && (
          <p className="mt-1.5 text-xs text-slate-400">按 Ctrl+Enter 快速发送</p>
        )}
        {isAdjusting && (
          <p className="mt-1.5 text-xs text-teal-500 animate-pulse">正在分析调整意图...</p>
        )}
      </div>
    </div>
  );
}
