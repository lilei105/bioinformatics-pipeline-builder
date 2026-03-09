import type { ParseResult, PlanResult, GenerateResult, PipelineStep } from '../types';

function timestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

const PIPELINE_SCENARIOS: Record<string, { start_types: string[]; goal_types: string[]; steps: PipelineStep[] }> = {
  default: {
    start_types: ['RawPairedReads.Forward', 'RawPairedReads.Reverse'],
    goal_types: ['PCoAResult'],
    steps: [
      { type: 'tool', tool_id: 'cutadapt', display: 'cutadapt' },
      { type: 'tool', tool_id: 'fastp_qc', display: 'fastp_qc' },
      { type: 'tool', tool_id: 'dada2', display: 'dada2' },
      { type: 'aggregate', from: 'CleanReads', to: 'SampleManifest', display: 'AGGREGATE(CleanReads → SampleManifest)' },
      { type: 'tool', tool_id: 'qiime2_import', display: 'qiime2_import' },
      { type: 'tool', tool_id: 'qiime2_denoise', display: 'qiime2_denoise' },
      {
        type: 'branch',
        branches: [['qiime2_classify'], ['qiime2_diversity']],
        display: 'BRANCH(2 并行分支)',
      },
      { type: 'tool', tool_id: 'qiime2_pcoa', display: 'qiime2_pcoa' },
    ],
  },
  metagenomics: {
    start_types: ['RawPairedReads.Forward', 'RawPairedReads.Reverse'],
    goal_types: ['TaxonomyProfile'],
    steps: [
      { type: 'tool', tool_id: 'fastp_qc', display: 'fastp_qc' },
      { type: 'tool', tool_id: 'host_removal', display: 'host_removal' },
      { type: 'tool', tool_id: 'kraken2', display: 'kraken2' },
      { type: 'tool', tool_id: 'bracken', display: 'bracken' },
      { type: 'tool', tool_id: 'krona_report', display: 'krona_report' },
    ],
  },
  rnaseq: {
    start_types: ['RawPairedReads.Forward', 'RawPairedReads.Reverse'],
    goal_types: ['DEGList'],
    steps: [
      { type: 'tool', tool_id: 'fastp_qc', display: 'fastp_qc' },
      { type: 'tool', tool_id: 'star_align', display: 'star_align' },
      { type: 'tool', tool_id: 'featureCounts', display: 'featureCounts' },
      {
        type: 'branch',
        branches: [['DESeq2'], ['edgeR']],
        display: 'BRANCH(2 并行分支)',
      },
      { type: 'aggregate', from: 'DEGResult', to: 'MergedDEG', display: 'AGGREGATE(DEGResult → MergedDEG)' },
    ],
  },
};

function detectScenario(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('16s') || lower.includes('pcoa') || lower.includes('扩增子') || lower.includes('多样性')) {
    return 'default';
  }
  if (lower.includes('宏基因组') || lower.includes('metagenom') || lower.includes('分类注释')) {
    return 'metagenomics';
  }
  if (lower.includes('rna') || lower.includes('转录') || lower.includes('差异表达') || lower.includes('deg')) {
    return 'rnaseq';
  }
  return 'default';
}

let planStepIndex = 0;
let currentScenario = 'default';

export async function apiParse(userInput: string, sessionId?: string): Promise<ParseResult> {
  await delay(1200);
  currentScenario = detectScenario(userInput);
  planStepIndex = 0;
  const scenario = PIPELINE_SCENARIOS[currentScenario];
  const sid = sessionId || Math.random().toString(36).slice(2, 10);

  return {
    success: true,
    session_id: sid,
    start_types: scenario.start_types,
    goal_types: scenario.goal_types,
    logs: [
      `[${timestamp()}] 正在调用大语言模型解析意图...`,
      `[${timestamp()}] 分析用户输入: "${userInput}"`,
      `[${timestamp()}] 识别起始数据类型: ${scenario.start_types.join(', ')}`,
      `[${timestamp()}] 识别目标数据类型: ${scenario.goal_types.join(', ')}`,
      `[${timestamp()}] 意图解析完成`,
    ],
  };
}

export async function apiPlan(sessionId: string, externalData?: Record<string, string>): Promise<PlanResult> {
  await delay(800);
  const scenario = PIPELINE_SCENARIOS[currentScenario];
  const steps = scenario.steps;

  const currentSteps = steps.slice(0, planStepIndex + 1);
  const currentStep = steps[planStepIndex];
  planStepIndex = Math.min(planStepIndex + 1, steps.length);

  const isCompleted = planStepIndex >= steps.length;

  const logs = [
    `[${timestamp()}] 正在规划工作流步骤 ${planStepIndex}/${steps.length}...`,
    `[${timestamp()}] 当前工具: ${currentStep?.type === 'tool' ? currentStep.tool_id : currentStep?.display}`,
    `[${timestamp()}] 检查语义类型匹配...`,
  ];

  if (isCompleted) {
    logs.push(`[${timestamp()}] 工作流规划完成，共 ${steps.length} 个步骤`);
  }

  return {
    success: true,
    session_id: sessionId,
    status: isCompleted ? 'completed' : 'planning',
    planned_steps: currentSteps,
    current_tool: currentStep?.type === 'tool' ? currentStep.tool_id : undefined,
    available_types: scenario.start_types,
    required_external: isCompleted
      ? [
          {
            type: 'ReferenceDatabase.Reads',
            name: '参考数据库序列',
            description: '用于物种注释的16S参考数据库序列文件',
            example: 'silva-138-99-seqs.qza',
          },
          {
            type: 'ReferenceDatabase.Taxonomy',
            name: '参考数据库分类学',
            description: '对应参考数据库的分类学信息文件',
            example: 'silva-138-99-tax.qza',
          },
        ]
      : undefined,
    logs,
    has_more: !isCompleted,
  };
}

export async function apiGenerate(
  sessionId: string,
  sampleId: string,
  initialData: Record<string, string>,
  externalData: Record<string, string>
): Promise<GenerateResult> {
  await delay(1500);
  const scenario = PIPELINE_SCENARIOS[currentScenario];
  const script = generateMockScript(sampleId, scenario.steps, initialData, externalData);

  return {
    success: true,
    script,
    script_path: `/workspace/20260309_120000_${sessionId}/pipeline.sh`,
    log_path: `/workspace/20260309_120000_${sessionId}/run.log`,
    logs: [
      `[${timestamp()}] 开始生成 Shell 脚本...`,
      `[${timestamp()}] 绑定输入数据路径...`,
      `[${timestamp()}] 解析工具参数配置...`,
      `[${timestamp()}] 渲染脚本模板...`,
      `[${timestamp()}] 脚本已生成: /workspace/20260309_120000_${sessionId}/pipeline.sh`,
    ],
  };
}

function generateMockScript(
  sampleId: string,
  steps: PipelineStep[],
  initialData: Record<string, string>,
  externalData: Record<string, string>
): string {
  const lines: string[] = [
    '#!/bin/bash',
    'set -e',
    '',
    `# 生物信息学分析流水线`,
    `# 样本 ID: ${sampleId}`,
    `# 生成时间: ${new Date().toISOString()}`,
    '',
    '# === 输入数据 ===',
  ];

  for (const [type, path] of Object.entries(initialData)) {
    lines.push(`# ${type}: ${path}`);
  }
  for (const [type, path] of Object.entries(externalData)) {
    lines.push(`# ${type}: ${path}`);
  }

  lines.push('', '# === 创建工作目录 ===');
  lines.push(`WORKSPACE="/workspace/$(date +%Y%m%d_%H%M%S)_${sampleId}"`);
  lines.push('mkdir -p "$WORKSPACE"');
  lines.push('');

  let stepNum = 1;
  for (const step of steps) {
    if (step.type === 'tool') {
      lines.push(`# === 步骤 ${stepNum}: ${step.tool_id} ===`);
      lines.push(`STEP${stepNum}_DIR="$WORKSPACE/step${stepNum}_${step.tool_id}"`);
      lines.push(`mkdir -p "$STEP${stepNum}_DIR"`);
      lines.push('');
      lines.push(`${step.tool_id} \\`);
      lines.push(`  --input "$STEP${stepNum - 1 > 0 ? `STEP${stepNum - 1}_OUT` : 'INPUT'}" \\`);
      lines.push(`  --output "$STEP${stepNum}_DIR/${sampleId}.output" \\`);
      lines.push(`  --threads 8`);
      lines.push(`STEP${stepNum}_OUT="$STEP${stepNum}_DIR/${sampleId}.output"`);
      lines.push('');
      stepNum++;
    } else if (step.type === 'aggregate') {
      lines.push(`# === 聚合: ${step.display} ===`);
      lines.push(`AGGREGATE_DIR="$WORKSPACE/aggregate"`);
      lines.push(`mkdir -p "$AGGREGATE_DIR"`);
      lines.push(`ls "$WORKSPACE"/step*/output > "$AGGREGATE_DIR/manifest.tsv"`);
      lines.push('');
    } else if (step.type === 'branch') {
      lines.push(`# === 并行分支 ===`);
      step.branches.forEach((branch, idx) => {
        lines.push(`# 分支 ${idx + 1}: ${branch.join(' → ')}`);
        branch.forEach((tool) => {
          lines.push(`BRANCH${idx + 1}_DIR="$WORKSPACE/branch${idx + 1}_${tool}"`);
          lines.push(`mkdir -p "$BRANCH${idx + 1}_DIR"`);
          lines.push(`${tool} --input "$STEP${stepNum - 1}_OUT" --output "$BRANCH${idx + 1}_DIR/${sampleId}.out" &`);
        });
      });
      lines.push('wait  # 等待所有分支完成');
      lines.push('');
    }
  }

  lines.push('echo "流水线执行完成！"');
  lines.push(`echo "结果目录: $WORKSPACE"`);

  return lines.join('\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
