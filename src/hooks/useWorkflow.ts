import { useState, useCallback, useRef } from 'react';
import type { WorkflowStatus, PipelineStep, ExternalDep, AdjustRecord } from '../types';
import type { PlannedStep } from '../engine/types';
import { loadAllSummaries, loadFull } from '../engine/yamlLoader';
import { planPipeline, collectAllSemanticTypes } from '../engine/planner';
import { generateScript } from '../engine/scriptGenerator';
import { parseIntent } from '../services/intentParser';
import { parseAdjustment } from '../services/pipelineAdjuster';

function ts(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function toUiSteps(planned: PlannedStep[], toolNames: Map<string, string>): PipelineStep[] {
  return planned.map((s) => {
    if (s.kind === 'tool') {
      return { type: 'tool', tool_id: s.toolId, display: toolNames.get(s.toolId) ?? s.toolId };
    }
    if (s.kind === 'aggregate') {
      return {
        type: 'aggregate',
        from: s.fromType,
        to: s.toType,
        display: `AGGREGATE(${s.fromType} → ${s.toType})`,
      };
    }
    return {
      type: 'branch',
      branches: s.toolIds.map((id) => [toolNames.get(id) ?? id]),
      display: `BRANCH(${s.toolIds.length} 并行分支)`,
    };
  });
}

export function useWorkflow() {
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plannedSteps, setPlannedSteps] = useState<PipelineStep[]>([]);
  const [startTypes, setStartTypes] = useState<string[]>([]);
  const [goalTypes, setGoalTypes] = useState<string[]>([]);
  const [requiredExternal, setRequiredExternal] = useState<ExternalDep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [scriptPath, setScriptPath] = useState<string>('');
  const [adjustHistory, setAdjustHistory] = useState<AdjustRecord[]>([]);
  const [originalIntent, setOriginalIntent] = useState<string>('');
  const cancelRef = useRef(false);
  const internalStepsRef = useRef<PlannedStep[]>([]);
  const summariesRef = useRef<Awaited<ReturnType<typeof loadAllSummaries>>>([]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${ts()}] ${msg}`]);
  }, []);

  const runPlanning = useCallback(
    async (
      startTypesInput: string[],
      goalTypesInput: string[],
      summaries: Awaited<ReturnType<typeof loadAllSummaries>>,
      toolNames: Map<string, string>,
      preferredOrder?: string[]
    ) => {
      setStatus('planning');
      addLog('启动 BFS 工作流规划器（前向调度 + 后向可达性分析）...');

      const result = planPipeline(startTypesInput, goalTypesInput, summaries, preferredOrder);
      internalStepsRef.current = result.steps;

      if (result.steps.length === 0) {
        addLog('规划器未能找到可行路径，请检查起始类型和目标类型是否正确');
        setStatus('failed');
        return false;
      }

      addLog(`规划完成，共 ${result.steps.length} 个步骤`);

      for (let i = 0; i < result.steps.length; i++) {
        if (cancelRef.current) return false;
        const step = result.steps[i];
        let label = '';
        if (step.kind === 'tool') label = `工具: ${step.toolId}`;
        else if (step.kind === 'parallel') label = `并行: ${step.toolIds.join(' | ')}`;
        else label = `聚合: ${step.fromType} → ${step.toType}`;
        addLog(`步骤 ${i + 1}: ${label}`);
        setPlannedSteps(toUiSteps(result.steps.slice(0, i + 1), toolNames));
        await new Promise((r) => setTimeout(r, 80));
      }

      const extDeps: ExternalDep[] = result.requiredExternal.map((e) => ({
        type: e.semantic,
        name: e.semantic.split('.').pop() ?? e.semantic,
        description: e.description,
        example: e.example,
      }));
      setRequiredExternal(extDeps);

      if (result.requiredExternal.length > 0) {
        addLog(
          `需要用户提供 ${result.requiredExternal.length} 个外部文件: ${result.requiredExternal.map((e) => e.semantic).join(', ')}`
        );
      }

      setStatus('completed');
      addLog('工作流规划完成');
      return true;
    },
    [addLog]
  );

  const startPlanning = useCallback(
    async (userInput: string) => {
      cancelRef.current = false;
      setStatus('parsing');
      setPlannedSteps([]);
      setLogs([]);
      setGeneratedScript('');
      setAdjustHistory([]);
      setOriginalIntent(userInput);
      internalStepsRef.current = [];

      const sid = Math.random().toString(36).slice(2, 10);
      setSessionId(sid);

      try {
        addLog('正在加载工具摘要信息...');
        const summaries = await loadAllSummaries();
        summariesRef.current = summaries;
        addLog(`已加载 ${summaries.length} 个工具摘要（仅解析类型字段，按需延迟加载完整定义）`);

        const semanticTypes = collectAllSemanticTypes(summaries);
        addLog(`收集到 ${semanticTypes.length} 种语义类型，调用 LLM 解析意图...`);

        const intent = await parseIntent(userInput, semanticTypes);
        setStartTypes(intent.start_types);
        setGoalTypes(intent.goal_types);
        addLog(`起始类型: [${intent.start_types.join(', ')}]`);
        addLog(`目标类型: [${intent.goal_types.join(', ')}]`);

        if (cancelRef.current) return;

        const toolNames = new Map(summaries.map((s) => [s.id, s.id]));
        await runPlanning(intent.start_types, intent.goal_types, summaries, toolNames);
      } catch (err) {
        addLog(`规划失败: ${err instanceof Error ? err.message : String(err)}`);
        setStatus('failed');
      }
    },
    [addLog, runPlanning]
  );

  const adjustPipeline = useCallback(
    async (userAdjustment: string) => {
      const summaries = summariesRef.current;
      if (!summaries.length) {
        addLog('工具摘要未加载，无法调整流程');
        return;
      }

      setStatus('adjusting');
      addLog(`--- 调整请求: "${userAdjustment}" ---`);

      try {
        const semanticTypes = collectAllSemanticTypes(summaries);
        const currentStepIds = internalStepsRef.current.flatMap((s) =>
          s.kind === 'tool' ? [s.toolId] : s.kind === 'parallel' ? s.toolIds : []
        );

        addLog('调用 LLM 分析调整意图...');
        const instruction = await parseAdjustment({
          userAdjustment,
          originalIntent,
          currentStartTypes: startTypes,
          currentGoalTypes: goalTypes,
          currentStepIds,
          semanticTypes,
        });

        addLog(`操作类型: ${instruction.action} — ${instruction.reasoning}`);

        const toolNames = new Map(summaries.map((s) => [s.id, s.id]));

        setAdjustHistory((prev) => [
          ...prev,
          { input: userAdjustment, reasoning: instruction.reasoning, action: instruction.action },
        ]);

        if (instruction.action === 'reorder') {
          const newOrder = instruction.reordered_step_ids;
          if (!newOrder.length) {
            addLog('reorder 操作未返回有效的步骤顺序，跳过');
            setStatus('completed');
            return;
          }

          addLog(`按用户期望的顺序重新规划: [${newOrder.join(', ')}]`);
          setPlannedSteps([]);
          internalStepsRef.current = [];
          await runPlanning(startTypes, goalTypes, summaries, toolNames, newOrder);
          return;
        }

        if (instruction.action === 'remove_step') {
          const removeSet = new Set(instruction.remove_tool_ids);
          addLog(`移除工具: [${instruction.remove_tool_ids.join(', ')}]`);
          const filtered = internalStepsRef.current.flatMap((s) => {
            if (s.kind === 'tool') {
              return removeSet.has(s.toolId) ? [] : [s];
            }
            if (s.kind === 'parallel') {
              const remaining = s.toolIds.filter((id) => !removeSet.has(id));
              if (remaining.length === 0) return [];
              if (remaining.length === 1) return [{ kind: 'tool' as const, toolId: remaining[0] }];
              return [{ kind: 'parallel' as const, toolIds: remaining }];
            }
            return [s];
          });
          internalStepsRef.current = filtered;
          setPlannedSteps(toUiSteps(filtered, toolNames));
          setStatus('completed');
          addLog(`流程已更新，当前共 ${filtered.length} 个步骤`);
          return;
        }

        let newStart = startTypes;
        let newGoal = goalTypes;

        if (instruction.action === 'update_start') {
          newStart = instruction.new_start_types.length > 0 ? instruction.new_start_types : startTypes;
          addLog(`更新起始类型: [${newStart.join(', ')}]`);
          setStartTypes(newStart);
        } else if (instruction.action === 'add_goal') {
          newGoal = [...goalTypes, ...instruction.new_goal_types.filter((t) => !goalTypes.includes(t))];
          addLog(`追加目标类型: [${instruction.new_goal_types.join(', ')}]`);
          setGoalTypes(newGoal);
        } else if (instruction.action === 'replan') {
          if (!instruction.new_start_types.length && !instruction.new_goal_types.length) {
            addLog('replan 未返回新的起始或目标类型，无法执行重新规划。请更明确地描述新的分析需求（例如新的数据类型或分析目标）');
            setStatus('completed');
            return;
          }
          newStart = instruction.new_start_types.length > 0 ? instruction.new_start_types : startTypes;
          newGoal = instruction.new_goal_types.length > 0 ? instruction.new_goal_types : goalTypes;
          addLog(`重新规划 — 起始: [${newStart.join(', ')}]，目标: [${newGoal.join(', ')}]`);
          setStartTypes(newStart);
          setGoalTypes(newGoal);
        }

        setPlannedSteps([]);
        internalStepsRef.current = [];
        await runPlanning(newStart, newGoal, summaries, toolNames);
      } catch (err) {
        addLog(`调整失败: ${err instanceof Error ? err.message : String(err)}`);
        setStatus('completed');
      }
    },
    [addLog, startTypes, goalTypes, originalIntent, runPlanning]
  );

  const generateScriptAction = useCallback(
    async (
      sampleId: string,
      initialData: Record<string, string>,
      externalData: Record<string, string>
    ) => {
      setStatus('generating');
      addLog('开始生成 Shell 脚本...');

      try {
        const toolIds = internalStepsRef.current.flatMap((s) =>
          s.kind === 'tool' ? [s.toolId] : s.kind === 'parallel' ? s.toolIds : []
        );
        addLog(`按需加载 ${toolIds.length} 个工具的完整定义（脚本模板 + 参数）...`);
        await Promise.all(toolIds.map((id) => loadFull(id)));
        addLog('完整工具定义加载完成，开始渲染脚本模板...');

        const workspaceDir = `/workspace/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${sampleId}`;
        const script = await generateScript(internalStepsRef.current, {
          sampleId,
          workspaceDir,
          initialData,
          externalData,
        });

        const path = `${workspaceDir}/pipeline.sh`;
        setGeneratedScript(script);
        setScriptPath(path);
        addLog(`脚本已生成: ${path}`);
        setStatus('completed');
      } catch (err) {
        addLog(`脚本生成失败: ${err instanceof Error ? err.message : String(err)}`);
        setStatus('failed');
      }
    },
    [addLog]
  );

  const reset = useCallback(() => {
    cancelRef.current = true;
    setStatus('idle');
    setSessionId(null);
    setPlannedSteps([]);
    setStartTypes([]);
    setGoalTypes([]);
    setRequiredExternal([]);
    setLogs([]);
    setGeneratedScript('');
    setScriptPath('');
    setAdjustHistory([]);
    setOriginalIntent('');
    internalStepsRef.current = [];
    summariesRef.current = [];
  }, []);

  return {
    status,
    sessionId,
    plannedSteps,
    startTypes,
    goalTypes,
    requiredExternal,
    logs,
    generatedScript,
    scriptPath,
    adjustHistory,
    originalIntent,
    startPlanning,
    adjustPipeline,
    generateScript: generateScriptAction,
    reset,
  };
}
