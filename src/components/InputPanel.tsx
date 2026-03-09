import { useState } from 'react';
import { Sparkles, ChevronRight, Dna } from 'lucide-react';
import type { WorkflowStatus } from '../types';

const EXAMPLES = [
  '刱16S扩增子测序数据进行从原始序列到PCoA多样性分析',
  '对宏基因组双端测序数据进行物种分类注释',
  '对RNA-seq数据进行差异基因表达分析',
];

interface Props {
  status: WorkflowStatus;
  onStart: (input: string) => void;
  onReset: () => void;
}

export default function InputPanel({ status, onStart, onReset }: Props) {
  const [input, setInput] = useState('');

  const isRunning = status === 'parsing' || status === 'planning' || status === 'generating';
  const hasResult = status === 'completed' || status === 'need_input';
  const isFailed = status === 'failed';

  const handleSubmit = () => {
    if (!input.trim() || isRunning) return;
    onStart(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Dna size={18} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">描述您的分析需求</h2>
          <p className="text-xs text-slate-500 mt-0.5">用自然语言描述起始数据类型和目标分析结果</p>
        </div>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="例如：刱16S扩增子数据进行从原始序列到PCoA多样性分析..."
        disabled={isRunning || hasResult}
        rows={3}
        className="w-full px-3.5 py-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
      />

      {!hasResult && !isFailed && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setInput(ex)}
              disabled={isRunning}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed truncate max-w-[240px]"
              title={ex}
            >
              {ex.length > 22 ? ex.slice(0, 22) + '…' : ex}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {!hasResult && !isFailed ? (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                规划中...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                开始规划
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all"
          >
            <ChevronRight size={14} className="rotate-180" />
            重新规划
          </button>
        )}

        {isRunning && (
          <span className="text-xs text-slate-500 animate-pulse">
            {status === 'parsing' ? '正在解析意图...' : status === 'generating' ? '正在生成脚本...' : '正在规划工作流...'}
          </span>
        )}
      </div>

      {input && !isRunning && !hasResult && !isFailed && (
        <p className="mt-2 text-xs text-slate-400">按 Ctrl+Enter 快速开始</p>
      )}
    </div>
  );
}
