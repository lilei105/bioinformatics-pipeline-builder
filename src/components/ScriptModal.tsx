import { useEffect, useRef, useState } from 'react';
import { X, Copy, Download, Check, FileCode2 } from 'lucide-react';

interface Props {
  script: string;
  scriptPath: string;
  onClose: () => void;
}

export default function ScriptModal({ script, scriptPath, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipeline.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const lines = script.split('\n');

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in"
        style={{ animation: 'fadeIn 0.18s ease' }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <FileCode2 size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm">生成的 Shell 脚本</h3>
            <p className="text-slate-400 text-xs truncate font-mono mt-0.5">{scriptPath}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-all"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
            >
              <Download size={13} />
              下载
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <div className="flex text-xs font-mono leading-relaxed">
            <div className="select-none text-right pr-4 pl-4 pt-4 pb-4 text-slate-600 border-r border-slate-700/50 shrink-0" style={{ minWidth: '3rem' }}>
              {lines.map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-x-auto">
              <pre className="p-4 text-slate-300 leading-6 whitespace-pre">
                {lines.map((line, i) => (
                  <LineHighlight key={i} line={line} />
                ))}
              </pre>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between">
          <span className="text-slate-500 text-xs">
            共 {lines.length} 行 · {new Blob([script]).size} 字节
          </span>
          <span className="text-slate-500 text-xs font-mono">shell / bash</span>
        </div>
      </div>
    </div>
  );
}

function LineHighlight({ line }: { line: string }) {
  if (line.startsWith('#')) {
    return <div className="text-slate-500 leading-6">{line}</div>;
  }
  if (line.startsWith('#!/')) {
    return <div className="text-amber-400 leading-6">{line}</div>;
  }
  if (/^(set|export|mkdir|echo|ls|wait)\b/.test(line.trim())) {
    return <div className="leading-6"><span className="text-sky-400">{line.split(' ')[0]}</span><span>{line.slice(line.split(' ')[0].length)}</span></div>;
  }
  if (line.includes('=') && !line.includes(' ')) {
    const idx = line.indexOf('=');
    return (
      <div className="leading-6">
        <span className="text-violet-400">{line.slice(0, idx)}</span>
        <span className="text-slate-400">=</span>
        <span className="text-emerald-400">{line.slice(idx + 1)}</span>
      </div>
    );
  }
  return <div className="leading-6">{line}</div>;
}
