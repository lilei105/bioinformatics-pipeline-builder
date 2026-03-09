import type { ToolSummary, InputPort, OutputPort, PlannerResult, PlannedStep, ExternalRequirement } from './types';

function semanticMatch(available: string, required: string): boolean {
  if (available === required) return true;
  if (available.startsWith(required + '.')) return true;
  if (required.startsWith(available + '.')) return true;
  return false;
}

function typeAvailable(availableSet: Set<string>, required: string): boolean {
  for (const t of availableSet) {
    if (semanticMatch(t, required)) return true;
  }
  return false;
}

function canRunTool(tool: ToolSummary, available: Set<string>): boolean {
  for (const inp of tool.inputs) {
    if (!inp.required) continue;
    if (inp.aggregationInput) {
      if (!typeAvailable(available, inp.aggregationFrom ?? inp.semantic)) return false;
    } else {
      if (!typeAvailable(available, inp.semantic)) return false;
    }
  }
  return true;
}

function outputsOf(tool: ToolSummary): string[] {
  return tool.outputs.map((o) => o.semantic);
}

function requiredInputsOf(tool: ToolSummary): string[] {
  return tool.inputs
    .filter((i) => i.required)
    .map((i) => (i.aggregationInput ? (i.aggregationFrom ?? i.semantic) : i.semantic));
}

interface AggregationOp {
  fromType: string;
  toType: string;
}

function findPendingAggregation(
  tools: ToolSummary[],
  scheduled: Set<string>,
  available: Set<string>
): AggregationOp | null {
  for (const tool of tools) {
    if (scheduled.has(tool.id)) continue;
    for (const inp of tool.inputs) {
      if (!inp.aggregationInput || !inp.aggregationFrom) continue;
      const fromType = inp.aggregationFrom;
      const toType = inp.semantic;
      if (typeAvailable(available, fromType) && !typeAvailable(available, toType)) {
        return { fromType, toType };
      }
    }
  }
  return null;
}

function backwardReachability(
  goalTypes: string[],
  allTools: ToolSummary[],
  startTypes: string[] = []
): { relevantTools: Set<string>; neededTypes: Set<string> } {
  const needed = new Set<string>(goalTypes);
  const relevantTools = new Set<string>();
  const startSet = new Set<string>(startTypes);

  let changed = true;
  while (changed) {
    changed = false;
    for (const tool of allTools) {
      if (relevantTools.has(tool.id)) continue;

      const producesNeeded = tool.outputs.some((o) =>
        [...needed].some((n) => semanticMatch(o.semantic, n))
      );
      if (!producesNeeded) continue;

      const producesStartType = tool.outputs.some((o) =>
        typeAvailable(startSet, o.semantic)
      );
      if (producesStartType) continue;

      relevantTools.add(tool.id);
      changed = true;

      for (const inp of tool.inputs) {
        const depType = inp.aggregationInput ? (inp.aggregationFrom ?? inp.semantic) : inp.semantic;
        if (!needed.has(depType)) {
          needed.add(depType);
        }
      }
    }
  }

  return { relevantTools, neededTypes: needed };
}

function findExternalDeps(
  startTypes: string[],
  relevantTools: ToolSummary[],
  neededTypes: Set<string>
): string[] {
  const startSet = new Set(startTypes);
  const external: string[] = [];
  for (const needed of neededTypes) {
    if (typeAvailable(startSet, needed)) continue;
    const canBeProduced = relevantTools.some((tool) =>
      tool.outputs.some((o) => semanticMatch(o.semantic, needed))
    );
    if (!canBeProduced) {
      external.push(needed);
    }
  }
  return external;
}

function describeExternalDep(semantic: string): ExternalRequirement {
  const descriptions: Record<string, { description: string; example: string }> = {
    SampleGroupInfo: { description: '样本分组信息文件（TSV格式）', example: 'group_info.tsv' },
    'ReferenceDatabase.Reads': { description: '参考数据库序列文件（如SILVA）', example: 'silva-138-99-seqs.qza' },
    'ReferenceDatabase.Taxonomy': { description: '参考数据库分类学文件', example: 'silva-138-99-tax.qza' },
    BlastDatabase: { description: 'BLAST核酸数据库目录', example: 'nt_database/' },
    ReferenceGenome: { description: '参考基因组文件', example: 'hg38.fasta' },
    GenericBioFile: { description: '通用生物信息文件', example: 'input.bio' },
    GenericBiomTable: { description: 'BIOM格式特征表', example: 'feature-table.biom' },
  };
  const match = Object.entries(descriptions).find(([k]) => semanticMatch(semantic, k));
  return {
    semantic,
    description: match?.[1].description ?? `${semantic} 类型的外部输入文件`,
    example: match?.[1].example ?? 'file.dat',
  };
}

function usefulOutputCount(tool: ToolSummary, neededTypes: Set<string>, available: Set<string>): number {
  return tool.outputs.filter(
    (o) => [...neededTypes].some((n) => semanticMatch(o.semantic, n)) && !typeAvailable(available, o.semantic)
  ).length;
}

export function planPipeline(
  startTypes: string[],
  goalTypes: string[],
  allTools: ToolSummary[],
  preferredOrder?: string[]
): PlannerResult {
  const { relevantTools: relevantIds, neededTypes } = backwardReachability(goalTypes, allTools, startTypes);
  const relevantTools = allTools.filter((t) => relevantIds.has(t.id));

  const externalSemantics = findExternalDeps(startTypes, relevantTools, neededTypes);
  const requiredExternal: ExternalRequirement[] = externalSemantics.map(describeExternalDep);

  const orderIndex = new Map<string, number>();
  if (preferredOrder) {
    preferredOrder.forEach((id, i) => orderIndex.set(id, i));
  }

  function isBlockedByPreferredOrder(toolId: string, scheduled: Set<string>): boolean {
    if (!preferredOrder || orderIndex.size === 0) return false;
    const myIndex = orderIndex.get(toolId);
    if (myIndex === undefined) return false;
    for (const [id, idx] of orderIndex) {
      if (idx < myIndex && !scheduled.has(id) && relevantIds.has(id)) return true;
    }
    return false;
  }

  const available = new Set<string>([...startTypes, ...externalSemantics]);
  const scheduled = new Set<string>();
  const steps: PlannedStep[] = [];

  const MAX_STEPS = 60;
  let iter = 0;

  while (iter++ < MAX_STEPS) {
    if (goalTypes.every((g) => typeAvailable(available, g))) break;

    const agg = findPendingAggregation(relevantTools, scheduled, available);
    if (agg) {
      steps.push({ kind: 'aggregate', fromType: agg.fromType, toType: agg.toType });
      available.add(agg.toType);
      continue;
    }

    const runnable = relevantTools.filter((t) => {
      if (scheduled.has(t.id)) return false;
      if (!canRunTool(t, available)) return false;
      if (isBlockedByPreferredOrder(t.id, scheduled)) return false;
      const hasUsefulOutput = t.outputs.some(
        (o) => [...neededTypes].some((n) => semanticMatch(o.semantic, n)) && !typeAvailable(available, o.semantic)
      );
      return hasUsefulOutput;
    });

    if (runnable.length === 0) break;

    runnable.sort((a, b) => {
      const ia = orderIndex.get(a.id) ?? Infinity;
      const ib = orderIndex.get(b.id) ?? Infinity;
      if (ia !== ib) return ia - ib;
      const da = usefulOutputCount(a, neededTypes, available);
      const db = usefulOutputCount(b, neededTypes, available);
      if (db !== da) return db - da;
      return a.id.localeCompare(b.id);
    });

    const parallelBatch = getParallelBatch(runnable, available);

    if (parallelBatch.length === 1) {
      const tool = parallelBatch[0];
      scheduled.add(tool.id);
      steps.push({ kind: 'tool', toolId: tool.id });
      for (const out of tool.outputs) available.add(out.semantic);
    } else {
      for (const tool of parallelBatch) {
        scheduled.add(tool.id);
        for (const out of tool.outputs) available.add(out.semantic);
      }
      steps.push({ kind: 'parallel', toolIds: parallelBatch.map((t) => t.id) });
    }
  }

  return {
    steps,
    requiredExternal,
    allAvailableTypes: [...available],
  };
}

function getParallelBatch(runnable: ToolSummary[], available: Set<string>): ToolSummary[] {
  if (runnable.length <= 1) return runnable.slice(0, 1);

  const outputSets = new Map<string, Set<string>>();
  for (const tool of runnable) {
    outputSets.set(tool.id, new Set(outputsOf(tool)));
  }

  const parallel: ToolSummary[] = [];
  for (const candidate of runnable) {
    const candidateOutputs = outputSets.get(candidate.id)!;
    const othersDependOnMe = runnable.some((other) => {
      if (other.id === candidate.id) return false;
      return requiredInputsOf(other).some((req) => {
        for (const co of candidateOutputs) {
          if (semanticMatch(co, req)) return true;
        }
        return false;
      });
    });
    const iDependOnOthers = runnable.some((other) => {
      if (other.id === candidate.id) return false;
      const otherOutputs = outputSets.get(other.id)!;
      return requiredInputsOf(candidate).some((req) => {
        if (typeAvailable(available, req)) return false;
        for (const oo of otherOutputs) {
          if (semanticMatch(oo, req)) return true;
        }
        return false;
      });
    });

    if (!iDependOnOthers) {
      if (!othersDependOnMe) {
        parallel.push(candidate);
      }
    }
  }

  const trulyIndependent = parallel.filter((t) => {
    return !parallel.some(
      (other) =>
        other.id !== t.id &&
        requiredInputsOf(t).some((req) => {
          if (typeAvailable(available, req)) return false;
          return outputSets.get(other.id)!.has(req);
        })
    );
  });

  if (trulyIndependent.length >= 2) return trulyIndependent;

  const dependencyTools = runnable.filter((t) => !trulyIndependent.find((p) => p.id === t.id));
  if (dependencyTools.length > 0) return [dependencyTools[0]];

  return runnable.slice(0, 1);
}

export function collectAllSemanticTypes(tools: ToolSummary[]): string[] {
  const types = new Set<string>();
  for (const tool of tools) {
    for (const inp of tool.inputs) types.add(inp.semantic);
    for (const out of tool.outputs) types.add(out.semantic);
  }
  return [...types].sort();
}
