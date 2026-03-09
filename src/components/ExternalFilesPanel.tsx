import { useState, useRef } from 'react';
import { Upload, FileText, FolderOpen, CheckCircle2, AlertCircle, Bug, X } from 'lucide-react';
import type { ExternalDep } from '../types';

interface FileState {
  mode: 'empty' | 'upload' | 'path' | 'placeholder';
  path: string;
  fileName?: string;
}

function makePlaceholder(semantic: string): string {
  return `/placeholder/${semantic.replace(/\./g, '_').toLowerCase()}`;
}

function makeDefaultPath(semantic: string): string {
  const seg = semantic.split('.').pop() ?? semantic;
  return `/data/${seg.toLowerCase()}`;
}

interface FileRowProps {
  semantic: string;
  label: string;
  sublabel?: string;
  description?: string;
  example?: string;
  fileState: FileState;
  onChange: (s: FileState) => void;
  debugMode: boolean;
}

function FileRow({ semantic, label, sublabel, description, example, fileState, onChange, debugMode }: FileRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveState: FileState = debugMode && fileState.mode === 'empty'
    ? { mode: 'placeholder', path: makePlaceholder(semantic) }
    : fileState;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ mode: 'upload', path: `./input_files/${file.name}`, fileName: file.name });
  };

  const handlePathChange = (v: string) => {
    onChange({ mode: v ? 'path' : 'empty', path: v });
  };

  const handleClear = () => {
    onChange({ mode: 'empty', path: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusIcon = () => {
    if (effectiveState.mode === 'upload') return <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />;
    if (effectiveState.mode === 'path') return <CheckCircle2 size={13} className="text-blue-500 shrink-0" />;
    if (effectiveState.mode === 'placeholder') return <Bug size={13} className="text-amber-500 shrink-0" />;
    return <AlertCircle size={13} className="text-slate-300 shrink-0" />;
  };

  const borderColor = () => {
    if (effectiveState.mode === 'upload') return 'border-emerald-200 bg-emerald-50/30';
    if (effectiveState.mode === 'path') return 'border-blue-200 bg-blue-50/20';
    if (effectiveState.mode === 'placeholder') return 'border-amber-200 bg-amber-50/30';
    return 'border-slate-200 bg-white';
  };

  return (
    <div className={`rounded-xl border p-3 transition-colors ${borderColor()}`}>
      <div className="flex items-start gap-2 mb-2">
        {statusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 font-mono">{label}</span>
            {sublabel && (
              <span className="text-xs text-slate-400 font-mono">{sublabel}</span>
            )}
          </div>
          {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
        </div>
        {(fileState.mode !== 'empty') && (
          <button onClick={handleClear} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 transition-colors shrink-0">
            <X size={12} />
          </button>
        )}
      </div>

      {effectiveState.mode === 'placeholder' ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-100 border border-amber-200">
          <Bug size={11} className="text-amber-600 shrink-0" />
          <span className="text-xs font-mono text-amber-700 truncate">{effectiveState.path}</span>
        </div>
      ) : effectiveState.mode === 'upload' ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-100 border border-emerald-200">
          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
          <span className="text-xs font-mono text-emerald-700 truncate">{effectiveState.fileName}</span>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            value={fileState.path}
            onChange={(e) => handlePathChange(e.target.value)}
            placeholder={example ? `/ref/${example}` : makeDefaultPath(semantic)}
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono placeholder-slate-300 bg-white transition-colors"
          />
          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium cursor-pointer transition-colors shrink-0 border border-slate-200">
            <Upload size={11} />
            上传
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}
    </div>
  );
}

interface Props {
  startTypes: string[];
  requiredExternal: ExternalDep[];
  onGenerate: (sampleId: string, initialData: Record<string, string>, externalData: Record<string, string>) => void;
  isGenerating: boolean;
}

export default function ExternalFilesPanel({ startTypes, requiredExternal, onGenerate, isGenerating }: Props) {
  const [sampleId, setSampleId] = useState('sample_001');
  const [debugMode, setDebugMode] = useState(false);

  const [initialStates, setInitialStates] = useState<Record<string, FileState>>(() =>
    Object.fromEntries(startTypes.map((t) => [t, { mode: 'empty' as const, path: '' }]))
  );
  const [externalStates, setExternalStates] = useState<Record<string, FileState>>(() =>
    Object.fromEntries(requiredExternal.map((d) => [d.type, { mode: 'empty' as const, path: '' }]))
  );

  const resolveState = (semantic: string, state: FileState): string => {
    if (state.mode === 'empty' && debugMode) return makePlaceholder(semantic);
    return state.path;
  };

  const allResolved =
    sampleId.trim() &&
    startTypes.every((t) => {
      const s = initialStates[t];
      return debugMode || (s && s.mode !== 'empty');
    }) &&
    requiredExternal.every((d) => {
      const s = externalStates[d.type];
      return debugMode || (s && s.mode !== 'empty');
    });

  const pendingCount = [
    ...startTypes.filter((t) => !initialStates[t] || initialStates[t].mode === 'empty'),
    ...requiredExternal.filter((d) => !externalStates[d.type] || externalStates[d.type].mode === 'empty'),
  ].length;

  const handleGenerate = () => {
    if (!sampleId.trim()) return;
    const initialData: Record<string, string> = {};
    for (const t of startTypes) {
      initialData[t] = resolveState(t, initialStates[t] ?? { mode: 'empty', path: '' });
    }
    const externalData: Record<string, string> = {};
    for (const d of requiredExternal) {
      externalData[d.type] = resolveState(d.type, externalStates[d.type] ?? { mode: 'empty', path: '' });
    }
    onGenerate(sampleId.trim(), initialData, externalData);
  };

  const handleFillPlaceholders = () => {
    setDebugMode(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">样本 ID</label>
        <input
          value={sampleId}
          onChange={(e) => setSampleId(e.target.value)}
          placeholder="输入样本标识符"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
        />
      </div>

      {startTypes.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText size={13} className="text-blue-500" />
            <span className="text-xs font-semibold text-slate-700">初始输入文件</span>
            <span className="ml-auto text-xs text-slate-400">{startTypes.length} 个文件</span>
          </div>
          <div className="space-y-2">
            {startTypes.map((type) => (
              <FileRow
                key={type}
                semantic={type}
                label={type}
                sublabel={undefined}
                fileState={initialStates[type] ?? { mode: 'empty', path: '' }}
                onChange={(s) => setInitialStates((prev) => ({ ...prev, [type]: s }))}
                debugMode={debugMode}
              />
            ))}
          </div>
        </section>
      )}

      {requiredExternal.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <FolderOpen size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-700">外部参考文件</span>
            <span className="ml-auto text-xs text-slate-400">{requiredExternal.length} 个文件</span>
          </div>
          <div className="space-y-2">
            {requiredExternal.map((dep) => (
              <FileRow
                key={dep.type}
                semantic={dep.type}
                label={dep.name || dep.type.split('.').pop() || dep.type}
                sublabel={dep.type}
                description={dep.description}
                example={dep.example}
                fileState={externalStates[dep.type] ?? { mode: 'empty', path: '' }}
                onChange={(s) => setExternalStates((prev) => ({ ...prev, [dep.type]: s }))}
                debugMode={debugMode}
              />
            ))}
          </div>
        </section>
      )}

      <div className="pt-1 space-y-2">
        {pendingCount > 0 && !debugMode && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle size={13} className="text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700 flex-1">
              还有 <strong>{pendingCount}</strong> 个文件未配置
            </span>
            <button
              onClick={handleFillPlaceholders}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium transition-colors shrink-0"
            >
              <Bug size={11} />
              调试模式
            </button>
          </div>
        )}

        {debugMode && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <Bug size={13} className="text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700 flex-1">调试模式：未配置文件将使用占位符路径</span>
            <button
              onClick={() => setDebugMode(false)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200 transition-colors shrink-0"
            >
              <X size={11} />
              关闭
            </button>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!allResolved || isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {isGenerating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <FileText size={14} />
              {debugMode && pendingCount > 0 ? '生成脚本（含占位符）' : '生成 Shell 脚本'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
