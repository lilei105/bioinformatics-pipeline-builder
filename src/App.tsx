import { useState } from 'react';
import { Dna, Activity, Github } from 'lucide-react';
import { useWorkflow } from './hooks/useWorkflow';
import InputPanel from './components/InputPanel';
import ExternalFilesPanel from './components/ExternalFilesPanel';
import PipelineCanvas from './components/PipelineCanvas';
import LogPanel from './components/LogPanel';
import ScriptModal from './components/ScriptModal';
import AdjustPanel from './components/AdjustPanel';

export default function App() {
  const workflow = useWorkflow();
  const [showScript, setShowScript] = useState(false);

  const isLoading =
    workflow.status === 'parsing' ||
    workflow.status === 'planning' ||
    workflow.status === 'generating' ||
    workflow.status === 'adjusting';

  const showExternalPanel =
    workflow.status === 'completed' ||
    workflow.status === 'generating' ||
    workflow.status === 'adjusting' ||
    (workflow.status !== 'idle' && workflow.status !== 'parsing' && workflow.plannedSteps.length > 0);

  const showAdjustPanel =
    (workflow.status === 'completed' || workflow.status === 'adjusting' || workflow.status === 'planning') &&
    workflow.plannedSteps.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Dna size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">生物信息学分析智能体</h1>
              <p className="text-xs text-slate-400 mt-0.5 leading-none">BioInfo Workflow Automation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={workflow.status} stepsCount={workflow.plannedSteps.length} />
            <a
              href="#"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 h-full">
          <div className="flex flex-col gap-4 min-w-0">
            <Card title="分析需求" icon={<Activity size={14} />} color="blue">
              <InputPanel
                status={workflow.status}
                onStart={workflow.startPlanning}
                onReset={workflow.reset}
              />
            </Card>

            {showAdjustPanel && (
              <Card
                title="调整流程"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="14" y2="12" />
                    <line x1="4" y1="18" x2="18" y2="18" />
                    <circle cx="17" cy="6" r="3" />
                    <circle cx="17" cy="18" r="3" />
                  </svg>
                }
                color="teal"
                badge={
                  workflow.adjustHistory.length > 0 ? (
                    <span className="text-xs text-teal-100 bg-teal-500/40 px-2 py-0.5 rounded-full">
                      {workflow.adjustHistory.length} 次调整
                    </span>
                  ) : null
                }
                noPadding
              >
                <AdjustPanel
                  status={workflow.status}
                  adjustHistory={workflow.adjustHistory}
                  originalIntent={workflow.originalIntent}
                  onAdjust={workflow.adjustPipeline}
                />
              </Card>
            )}

            {showExternalPanel && (
              <Card
                title="所需输入文件"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                    <polyline points="14,2 14,8 20,8" />
                  </svg>
                }
                color="amber"
                badge={
                  workflow.requiredExternal.length > 0 ? (
                    <span className="text-xs text-amber-100 bg-amber-500/40 px-2 py-0.5 rounded-full">
                      {workflow.startTypes.length + workflow.requiredExternal.length} 个文件待配置
                    </span>
                  ) : null
                }
              >
                {workflow.generatedScript ? (
                  <div className="p-5">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                          <polyline points="20,6 9,17 4,12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">脚本生成成功</p>
                        <p className="text-xs text-emerald-600 font-mono mt-0.5 truncate max-w-xs">
                          {workflow.scriptPath}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowScript(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-all shadow-sm"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <polyline points="16,18 22,12 16,6" />
                        <polyline points="8,6 2,12 8,18" />
                      </svg>
                      查看生成的脚本
                    </button>
                  </div>
                ) : (
                  <ExternalFilesPanel
                    startTypes={workflow.startTypes}
                    requiredExternal={workflow.requiredExternal}
                    onGenerate={workflow.generateScript}
                    isGenerating={workflow.status === 'generating'}
                  />
                )}
              </Card>
            )}

            {workflow.status === 'failed' && (
              <Card title="规划失败" icon={<Activity size={14} />} color="red">
                <div className="p-5">
                  <p className="text-sm text-red-600 mb-3">工作流规划未能完成，请检查日志并重新尝试。</p>
                  <button
                    onClick={workflow.reset}
                    className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium transition-colors"
                  >
                    重新开始
                  </button>
                </div>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex-1 min-h-0">
              <Card
                title="工作流图"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                }
                color="slate"
                noPadding
                className="h-full"
              >
                <div className="h-[520px] xl:h-[620px]">
                  <PipelineCanvas steps={workflow.plannedSteps} />
                </div>
              </Card>
            </div>

            <Card
              title="运行日志"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4,17 10,11 4,5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              }
              color="slate"
              noPadding
            >
              <div className="h-48">
                <LogPanel logs={workflow.logs} isLoading={isLoading} />
              </div>
            </Card>
          </div>
        </div>
      </main>

      {showScript && workflow.generatedScript && (
        <ScriptModal
          script={workflow.generatedScript}
          scriptPath={workflow.scriptPath}
          onClose={() => setShowScript(false)}
        />
      )}
    </div>
  );
}

interface CardProps {
  title: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'emerald' | 'violet' | 'red' | 'slate' | 'amber' | 'teal';
  children: React.ReactNode;
  badge?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

function Card({ title, icon, color = 'blue', children, badge, noPadding, className }: CardProps) {
  const headerColors = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    violet: 'bg-blue-700',
    red: 'bg-red-500',
    slate: 'bg-slate-700',
    amber: 'bg-amber-500',
    teal: 'bg-teal-600',
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ${className || ''}`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${headerColors[color]} text-white`}>
        {icon && <span className="opacity-80">{icon}</span>}
        <span className="text-sm font-semibold">{title}</span>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className={`flex-1 min-h-0 ${noPadding ? '' : ''}`}>{children}</div>
    </div>
  );
}

function StatusBadge({ status, stepsCount }: { status: string; stepsCount: number }) {
  const configs: Record<string, { label: string; cls: string; dot?: boolean }> = {
    idle: { label: '就绪', cls: 'bg-slate-100 text-slate-500' },
    parsing: { label: '解析意图', cls: 'bg-blue-50 text-blue-600', dot: true },
    planning: { label: `规划中 (${stepsCount} 步)`, cls: 'bg-amber-50 text-amber-600', dot: true },
    generating: { label: '生成脚本', cls: 'bg-blue-50 text-blue-600', dot: true },
    adjusting: { label: '调整中', cls: 'bg-teal-50 text-teal-600', dot: true },
    completed: { label: `规划完成 · ${stepsCount} 步`, cls: 'bg-emerald-50 text-emerald-600' },
    failed: { label: '规划失败', cls: 'bg-red-50 text-red-500' },
    need_input: { label: '需要输入', cls: 'bg-amber-50 text-amber-600' },
  };

  const config = configs[status] || configs.idle;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${config.cls}`}>
      {config.dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {config.label}
    </div>
  );
}
