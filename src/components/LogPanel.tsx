import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface Props {
  logs: string[];
  isLoading?: boolean;
}

export default function LogPanel({ logs, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <Terminal size={15} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">运行日志</span>
        {isLoading && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="text-xs text-blue-500 font-medium">运行中</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed min-h-0">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-300 text-xs">暂无日志</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <LogLine key={i} line={log} isLatest={i === logs.length - 1} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function LogLine({ line, isLatest }: { line: string; isLatest: boolean }) {
  const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('失败');
  const isSuccess = line.toLowerCase().includes('完成') || line.toLowerCase().includes('成功');
  const isWarning = line.toLowerCase().includes('warning') || line.toLowerCase().includes('警告');

  let textClass = 'text-slate-600';
  let prefixClass = 'text-slate-400';

  if (isError) {
    textClass = 'text-red-600';
    prefixClass = 'text-red-400';
  } else if (isSuccess) {
    textClass = 'text-emerald-600';
    prefixClass = 'text-emerald-400';
  } else if (isWarning) {
    textClass = 'text-amber-600';
    prefixClass = 'text-amber-400';
  }

  const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)/);

  return (
    <div className={`flex gap-2 py-0.5 ${isLatest ? 'bg-blue-50/50 rounded px-1' : ''}`}>
      {match ? (
        <>
          <span className={`${prefixClass} shrink-0`}>[{match[1]}]</span>
          <span className={textClass}>{match[2]}</span>
        </>
      ) : (
        <span className={textClass}>{line}</span>
      )}
    </div>
  );
}
