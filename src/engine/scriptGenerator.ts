import type { PlannedStep } from './types';
import { loadFull } from './yamlLoader';

interface GenerateOptions {
  sampleId: string;
  workspaceDir: string;
  initialData: Record<string, string>;
  externalData: Record<string, string>;
}

function semanticMatch(available: string, required: string): boolean {
  if (available === required) return true;
  if (available.startsWith(required + '.')) return true;
  if (required.startsWith(available + '.')) return true;
  return false;
}

function resolveType(dataPool: Map<string, string>, semantic: string): string | undefined {
  if (dataPool.has(semantic)) return dataPool.get(semantic);
  for (const [key, val] of dataPool) {
    if (semanticMatch(key, semantic)) return val;
  }
  return undefined;
}

function renderTemplate(
  template: string,
  inputPaths: Record<string, string>,
  outputPaths: Record<string, string>,
  params: Record<string, string>
): string {
  let result = template;
  for (const [id, path] of Object.entries(inputPaths)) {
    result = result.replaceAll(`{{ inputs.${id} }}`, path);
  }
  for (const [id, path] of Object.entries(outputPaths)) {
    result = result.replaceAll(`{{ outputs.${id} }}`, path);
  }
  for (const [id, val] of Object.entries(params)) {
    result = result.replaceAll(`{{ params.${id} }}`, val);
  }
  return result;
}

export async function generateScript(
  steps: PlannedStep[],
  opts: GenerateOptions
): Promise<string> {
  const { sampleId, workspaceDir, initialData, externalData } = opts;

  const dataPool = new Map<string, string>();
  for (const [sem, path] of Object.entries(initialData)) dataPool.set(sem, path);
  for (const [sem, path] of Object.entries(externalData)) dataPool.set(sem, path);

  const aggregationPool = new Map<string, string[]>();

  const lines: string[] = [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    `# 生物信息学分析流水线`,
    `# 样本 ID: ${sampleId}`,
    `# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')`,
    '',
    '# === 工作目录设置 ===',
    `WORKSPACE="${workspaceDir}"`,
    'mkdir -p "$WORKSPACE"',
    `cd "$WORKSPACE"`,
    '',
    '# === 输入数据 ===',
  ];

  for (const [sem, path] of Object.entries(initialData)) {
    lines.push(`# ${sem}: ${path}`);
  }
  for (const [sem, path] of Object.entries(externalData)) {
    lines.push(`# [外部] ${sem}: ${path}`);
  }
  lines.push('');

  let stepNum = 0;

  for (const step of steps) {
    if (step.kind === 'aggregate') {
      lines.push(`# === 聚合: ${step.fromType} → ${step.toType} ===`);
      const aggDir = `$WORKSPACE/aggregate_${step.toType.replace(/\./g, '_').toLowerCase()}`;
      lines.push(`mkdir -p "${aggDir}"`);
      const manifestPath = `${aggDir}/manifest.tsv`;
      lines.push(`printf 'sample-id\\tabsolute-filepath\\n' > "${manifestPath}"`);

      const sources = aggregationPool.get(step.fromType) ?? [];
      if (sources.length > 0) {
        for (const src of sources) {
          const sid = src.includes(sampleId) ? sampleId : `sample_${sources.indexOf(src) + 1}`;
          lines.push(`printf '${sid}\\t${src}\\n' >> "${manifestPath}"`);
        }
      } else {
        lines.push(`# 注意: 将每个样本的 ${step.fromType} 文件路径追加到此 manifest`);
        lines.push(`# printf '<sample-id>\\t<file-path>\\n' >> "${manifestPath}"`);
      }

      dataPool.set(step.toType, manifestPath);
      lines.push('');
      continue;
    }

    const toolIds = step.kind === 'tool' ? [step.toolId] : step.toolIds;
    const isParallel = step.kind === 'parallel' && toolIds.length > 1;

    if (isParallel) {
      lines.push(`# === 并行步骤 (${toolIds.join(', ')}) ===`);
    }

    for (const toolId of toolIds) {
      stepNum++;
      const tool = await loadFull(toolId);
      if (!tool) {
        lines.push(`# [警告] 未找到工具定义: ${toolId}`);
        continue;
      }

      const stepDir = `$WORKSPACE/step${String(stepNum).padStart(2, '0')}_${toolId}`;
      lines.push(`# === 步骤 ${stepNum}: ${tool.name} ===`);
      lines.push(`STEP${stepNum}_DIR="${stepDir}"`);
      lines.push(`mkdir -p "$STEP${stepNum}_DIR"`);
      lines.push('');

      const inputPaths: Record<string, string> = {};
      for (const inp of tool.inputs) {
        const resolved = resolveType(dataPool, inp.semantic);
        if (resolved) {
          inputPaths[inp.id] = resolved;
        } else if (inp.required) {
          inputPaths[inp.id] = `<MISSING:${inp.semantic}>`;
        }
      }

      const outputPaths: Record<string, string> = {};
      for (const out of tool.outputs) {
        const filename = out.filenameTemplate
          ? out.filenameTemplate.replace('{sample_id}', sampleId)
          : `${sampleId}.${out.id}.output`;
        const fullPath = `${stepDir}/${filename}`;
        outputPaths[out.id] = fullPath;

        if (out.aggregationOutput) {
          const existing = aggregationPool.get(out.semantic) ?? [];
          existing.push(fullPath);
          aggregationPool.set(out.semantic, existing);
        }
        dataPool.set(out.semantic, fullPath);
      }

      const params: Record<string, string> = {};
      for (const param of tool.parameters) {
        params[param.id] = String(param.default ?? '');
      }

      const rendered = renderTemplate(tool.scriptTemplate, inputPaths, outputPaths, params);

      lines.push(rendered.trimEnd());
      lines.push('');
    }

    if (isParallel) {
      lines.push('wait');
      lines.push('');
    }
  }

  lines.push('echo "====================================="');
  lines.push('echo "流水线执行完成！"');
  lines.push(`echo "结果目录: $WORKSPACE"`);

  return lines.join('\n');
}
