import * as jsYaml from 'js-yaml';
import type { ToolSummary, ToolFull, InputPort, OutputPort, Parameter } from './types';

const rawLoaders = import.meta.glob('../../tools/*.yaml', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function toolIdFromPath(path: string): string {
  return path.split('/').pop()!.replace('.yaml', '');
}

function parseSummary(raw: string, toolId: string): ToolSummary {
  const doc = jsYaml.load(raw) as Record<string, unknown>;

  const rawInputs = (doc.inputs as unknown[]) || [];
  const rawOutputs = (doc.outputs as unknown[]) || [];

  const inputs: InputPort[] = rawInputs.map((inp) => {
    const i = inp as Record<string, unknown>;
    const type = (i.type as Record<string, string>) || {};
    return {
      id: String(i.id ?? ''),
      description: String(i.description ?? ''),
      semantic: type.semantic ?? '',
      format: type.format ?? '',
      required: i.required !== false,
      aggregationInput: Boolean(i.aggregation_input),
      aggregationFrom: i.aggregation_from ? String(i.aggregation_from) : undefined,
    };
  });

  const outputs: OutputPort[] = rawOutputs.map((out) => {
    const o = out as Record<string, unknown>;
    const type = (o.type as Record<string, string>) || {};
    return {
      id: String(o.id ?? ''),
      description: String(o.description ?? ''),
      semantic: type.semantic ?? '',
      format: type.format ?? '',
      filenameTemplate: o.filename_template ? String(o.filename_template) : undefined,
      aggregationOutput: Boolean(o.aggregation_output),
    };
  });

  const desc = String(doc.description ?? '');
  const firstLine = desc.split('\n').find((l) => l.trim()) ?? desc.trim();

  return {
    id: toolId,
    name: String(doc.name ?? toolId),
    description: firstLine.trim(),
    inputs,
    outputs,
  };
}

function parseFull(raw: string, toolId: string): ToolFull {
  const doc = jsYaml.load(raw) as Record<string, unknown>;
  const summary = parseSummary(raw, toolId);

  const rawParams = (doc.parameters as unknown[]) || [];
  const parameters: Parameter[] = rawParams.map((p) => {
    const param = p as Record<string, unknown>;
    return {
      id: String(param.id ?? ''),
      description: String(param.description ?? ''),
      type: String(param.type ?? 'string'),
      required: Boolean(param.required),
      default: (param.default ?? '') as string | number | boolean,
      cliFlag: param.cli_flag ? String(param.cli_flag) : undefined,
    };
  });

  return {
    ...summary,
    version: String(doc.version ?? ''),
    parameters,
    scriptTemplate: String(doc.script_template ?? ''),
  };
}

const summaryCache = new Map<string, ToolSummary>();
const fullCache = new Map<string, ToolFull>();

export function getAllToolIds(): string[] {
  return Object.keys(rawLoaders).map(toolIdFromPath);
}

export async function loadSummary(toolId: string): Promise<ToolSummary | null> {
  if (summaryCache.has(toolId)) return summaryCache.get(toolId)!;

  const entry = Object.entries(rawLoaders).find(([p]) => toolIdFromPath(p) === toolId);
  if (!entry) return null;

  const raw = await entry[1]();
  const summary = parseSummary(raw, toolId);
  summaryCache.set(toolId, summary);
  return summary;
}

export async function loadFull(toolId: string): Promise<ToolFull | null> {
  if (fullCache.has(toolId)) return fullCache.get(toolId)!;

  const entry = Object.entries(rawLoaders).find(([p]) => toolIdFromPath(p) === toolId);
  if (!entry) return null;

  const raw = await entry[1]();
  const full = parseFull(raw, toolId);
  fullCache.set(toolId, full);
  return full;
}

export async function loadAllSummaries(): Promise<ToolSummary[]> {
  const ids = getAllToolIds();
  const results = await Promise.all(ids.map((id) => loadSummary(id)));
  return results.filter(Boolean) as ToolSummary[];
}
