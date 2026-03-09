import type { PipelineStep, SvgNode, SvgEdge } from '../types';
import { LAYOUT } from '../constants/colors';

const H_SPACING = 32;
const V_LAYER_GAP = 72;
const BRANCH_INTRA_GAP = 40;

function computeCenterX(steps: PipelineStep[]): number {
  const maxParallel = steps.reduce((max, step) => {
    if (step.type === 'branch') return Math.max(max, step.branches.length);
    return max;
  }, 1);
  const minWidth =
    maxParallel * LAYOUT.NODE_WIDTH +
    (maxParallel - 1) * H_SPACING +
    2 * LAYOUT.PADDING;
  return Math.max(LAYOUT.CENTER_X, minWidth / 2);
}

export function layoutPipeline(steps: PipelineStep[]): { nodes: SvgNode[]; edges: SvgEdge[] } {
  const nodes: SvgNode[] = [];
  const edges: SvgEdge[] = [];

  const centerX = computeCenterX(steps);

  let currentY = 60;
  let prevLayerIds: string[] = [];
  let nodeIdCounter = 0;

  for (const step of steps) {
    if (step.type === 'tool') {
      const node: SvgNode = {
        id: `node_${nodeIdCounter++}`,
        label: step.display || step.tool_id,
        nodeType: 'tool',
        x: centerX - LAYOUT.NODE_WIDTH / 2,
        y: currentY,
        width: LAYOUT.NODE_WIDTH,
        height: LAYOUT.NODE_HEIGHT,
        branchIndex: -1,
      };
      nodes.push(node);

      for (const src of prevLayerIds) {
        edges.push({ id: `edge_${src}_${node.id}`, source: src, target: node.id });
      }

      prevLayerIds = [node.id];
      currentY += LAYOUT.NODE_HEIGHT + V_LAYER_GAP;

    } else if (step.type === 'branch') {
      const branchCount = step.branches.length;
      const totalBranchWidth =
        branchCount * LAYOUT.NODE_WIDTH + (branchCount - 1) * H_SPACING;
      const branchStartX = centerX - totalBranchWidth / 2;

      let maxDepth = 0;
      const firstNodePerBranch: string[] = [];
      const lastNodePerBranch: string[] = [];

      step.branches.forEach((branch, branchIdx) => {
        const branchX = branchStartX + branchIdx * (LAYOUT.NODE_WIDTH + H_SPACING);
        let prevInBranchId: string | null = null;

        branch.forEach((toolLabel, toolIdx) => {
          const node: SvgNode = {
            id: `node_${nodeIdCounter++}`,
            label: toolLabel,
            nodeType: 'branch',
            x: branchX,
            y: currentY + toolIdx * (LAYOUT.NODE_HEIGHT + BRANCH_INTRA_GAP),
            width: LAYOUT.NODE_WIDTH,
            height: LAYOUT.NODE_HEIGHT,
            branchIndex: branchIdx,
          };
          nodes.push(node);

          if (prevInBranchId) {
            edges.push({
              id: `edge_${prevInBranchId}_${node.id}`,
              source: prevInBranchId,
              target: node.id,
            });
          } else {
            firstNodePerBranch.push(node.id);
          }

          prevInBranchId = node.id;
        });

        if (prevInBranchId) lastNodePerBranch.push(prevInBranchId);
        maxDepth = Math.max(maxDepth, branch.length);
      });

      for (const src of prevLayerIds) {
        for (const tgt of firstNodePerBranch) {
          edges.push({ id: `edge_${src}_${tgt}`, source: src, target: tgt });
        }
      }

      const branchHeight =
        maxDepth * LAYOUT.NODE_HEIGHT + (maxDepth - 1) * BRANCH_INTRA_GAP;
      currentY += branchHeight + V_LAYER_GAP;
      prevLayerIds = lastNodePerBranch;

    } else if (step.type === 'aggregate') {
      const node: SvgNode = {
        id: `node_${nodeIdCounter++}`,
        label: step.display || 'AGGREGATE',
        nodeType: 'aggregate',
        x: centerX - LAYOUT.NODE_WIDTH / 2,
        y: currentY,
        width: LAYOUT.NODE_WIDTH,
        height: LAYOUT.NODE_HEIGHT,
        branchIndex: -1,
      };
      nodes.push(node);

      for (const src of prevLayerIds) {
        edges.push({ id: `edge_${src}_${node.id}`, source: src, target: node.id });
      }

      prevLayerIds = [node.id];
      currentY += LAYOUT.NODE_HEIGHT + V_LAYER_GAP;
    }
  }

  return { nodes, edges };
}

export function computeFitView(
  nodes: SvgNode[],
  containerWidth: number,
  containerHeight: number
): { panX: number; panY: number; zoom: number } {
  if (nodes.length === 0) return { panX: 0, panY: 0, zoom: 1 };

  const minX = Math.min(...nodes.map((n) => n.x)) - LAYOUT.PADDING;
  const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + LAYOUT.PADDING;
  const minY = Math.min(...nodes.map((n) => n.y)) - LAYOUT.PADDING;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + LAYOUT.PADDING;

  const gw = maxX - minX;
  const gh = maxY - minY;

  const newZoom = Math.min(containerWidth / gw, containerHeight / gh, 1.5) * 0.92;

  const panX = (containerWidth - gw * newZoom) / 2 - minX * newZoom;
  const panY = (containerHeight - gh * newZoom) / 2 - minY * newZoom;

  return { panX, panY, zoom: newZoom };
}
