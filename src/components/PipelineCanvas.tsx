import { useRef, useEffect, useState, useCallback } from 'react';
import type { PipelineStep, SvgNode, SvgEdge } from '../types';
import { layoutPipeline, computeFitView } from '../utils/svgLayout';
import { NODE_COLORS, BRANCH_COLORS } from '../constants/colors';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface Props {
  steps: PipelineStep[];
}

interface ViewState {
  pan: { x: number; y: number };
  zoom: number;
}

interface DragState {
  nodeId: string;
  startMouseX: number;
  startMouseY: number;
  nodeStartX: number;
  nodeStartY: number;
}

interface PanState {
  startX: number;
  startY: number;
}

export default function PipelineCanvas({ steps }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<SvgNode[]>([]);
  const edgesRef = useRef<SvgEdge[]>([]);
  const viewRef = useRef<ViewState>({ pan: { x: 0, y: 0 }, zoom: 1 });
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const selectedNodeRef = useRef<SvgNode | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(100);
  const renderPendingRef = useRef(false);

  const doRenderRef = useRef<() => void>(() => {});

  const render = useCallback(() => {
    if (renderPendingRef.current) return;
    renderPendingRef.current = true;
    requestAnimationFrame(() => {
      renderPendingRef.current = false;
      doRenderRef.current();
    });
  }, []);

  function getNodeColors(node: SvgNode) {
    if (node.nodeType === 'tool') return NODE_COLORS.tool;
    if (node.nodeType === 'aggregate') return NODE_COLORS.aggregate;
    return BRANCH_COLORS[node.branchIndex % BRANCH_COLORS.length];
  }

  function createNodeEl(node: SvgNode): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'pipeline-node');
    g.setAttribute('data-node-id', node.id);
    g.style.cursor = 'grab';

    const colors = getNodeColors(node);
    const isSelected = selectedNodeRef.current?.id === node.id;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(node.x));
    rect.setAttribute('y', String(node.y));
    rect.setAttribute('width', String(node.width));
    rect.setAttribute('height', String(node.height));
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');
    rect.setAttribute('fill', colors.fill);
    rect.setAttribute('stroke', colors.stroke);
    rect.setAttribute('stroke-width', isSelected ? '3' : '1.5');
    if (isSelected) {
      rect.setAttribute('filter', 'url(#node-shadow)');
    }
    g.appendChild(rect);

    const iconText = node.nodeType === 'aggregate' ? '⬡' : '▶';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    icon.setAttribute('x', String(node.x + 12));
    icon.setAttribute('y', String(node.y + node.height / 2));
    icon.setAttribute('dominant-baseline', 'middle');
    icon.setAttribute('font-size', '11');
    icon.setAttribute('fill', colors.stroke);
    icon.textContent = iconText;
    g.appendChild(icon);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(node.x + 28));
    text.setAttribute('y', String(node.y + node.height / 2));
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-weight', '500');
    text.setAttribute('fill', colors.text);
    text.setAttribute('font-family', 'ui-monospace, SFMono-Regular, monospace');

    const maxChars = 16;
    const label = node.label.length > maxChars ? node.label.slice(0, maxChars) + '…' : node.label;
    text.textContent = label;
    g.appendChild(text);

    g.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectedNodeRef.current = node;
      dragStateRef.current = {
        nodeId: node.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodeStartX: node.x,
        nodeStartY: node.y,
      };
      render();
    });

    return g;
  }

  function createEdgeEl(source: SvgNode, target: SvgNode): SVGElement {
    const sx = source.x + source.width / 2;
    const sy = source.y + source.height;
    const tx = target.x + target.width / 2;
    const ty = target.y;
    const dy = (ty - sy) * 0.5;
    const d = `M ${sx} ${sy} C ${sx} ${sy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}`;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '10');
    hitPath.setAttribute('fill', 'none');
    g.appendChild(hitPath);

    const visPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visPath.setAttribute('d', d);
    visPath.setAttribute('stroke', '#94a3b8');
    visPath.setAttribute('stroke-width', '1.5');
    visPath.setAttribute('fill', 'none');
    visPath.setAttribute('marker-end', 'url(#arrow)');
    g.appendChild(visPath);

    return g;
  }

  useEffect(() => {
    doRenderRef.current = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const content = svg.querySelector('.pipeline-content') as SVGGElement;
      if (!content) return;
      content.innerHTML = '';
      const { pan, zoom } = viewRef.current;
      content.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`);
      setZoomDisplay(Math.round(zoom * 100));
      for (const edge of edgesRef.current) {
        const source = nodesRef.current.find((n) => n.id === edge.source);
        const target = nodesRef.current.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        content.appendChild(createEdgeEl(source, target));
      }
      for (const node of nodesRef.current) {
        content.appendChild(createNodeEl(node));
      }
    };
  });

  const fitView = useCallback(() => {
    if (!containerRef.current || nodesRef.current.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { panX, panY, zoom } = computeFitView(nodesRef.current, rect.width, rect.height);
    viewRef.current = { pan: { x: panX, y: panY }, zoom };
    render();
  }, [render]);

  useEffect(() => {
    const { nodes, edges } = layoutPipeline(steps);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    viewRef.current = { pan: { x: 0, y: 0 }, zoom: 1 };
    selectedNodeRef.current = null;

    if (nodes.length > 0) {
      setTimeout(() => fitView(), 50);
    } else {
      render();
    }
  }, [steps, fitView, render]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragStateRef.current) {
        const ds = dragStateRef.current;
        const zoom = viewRef.current.zoom;
        const dx = (e.clientX - ds.startMouseX) / zoom;
        const dy = (e.clientY - ds.startMouseY) / zoom;
        const node = nodesRef.current.find((n) => n.id === ds.nodeId);
        if (node) {
          node.x = ds.nodeStartX + dx;
          node.y = ds.nodeStartY + dy;
          render();
        }
      } else if (panStateRef.current) {
        const ps = panStateRef.current;
        viewRef.current.pan = {
          x: e.clientX - ps.startX,
          y: e.clientY - ps.startY,
        };
        render();
      }
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
      panStateRef.current = null;
    };

    const handleSvgMouseDown = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      if (target === svg || target.classList.contains('svg-bg')) {
        selectedNodeRef.current = null;
        panStateRef.current = {
          startX: e.clientX - viewRef.current.pan.x,
          startY: e.clientY - viewRef.current.pan.y,
        };
        render();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const { zoom, pan } = viewRef.current;
      const newZoom = Math.min(Math.max(zoom * delta, 0.15), 4);
      viewRef.current = {
        zoom: newZoom,
        pan: {
          x: mx - (mx - pan.x) * (newZoom / zoom),
          y: my - (my - pan.y) * (newZoom / zoom),
        },
      };
      render();
    };

    svg.addEventListener('mousedown', handleSvgMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    svg.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      svg.removeEventListener('mousedown', handleSvgMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [render]);

  const handleZoomIn = () => {
    const { zoom, pan } = viewRef.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const newZoom = Math.min(zoom * 1.2, 4);
    viewRef.current = {
      zoom: newZoom,
      pan: { x: mx - (mx - pan.x) * (newZoom / zoom), y: my - (my - pan.y) * (newZoom / zoom) },
    };
    render();
  };

  const handleZoomOut = () => {
    const { zoom, pan } = viewRef.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const newZoom = Math.max(zoom * 0.8, 0.15);
    viewRef.current = {
      zoom: newZoom,
      pan: { x: mx - (mx - pan.x) * (newZoom / zoom), y: my - (my - pan.y) * (newZoom / zoom) },
    };
    render();
  };

  const handleReset = () => {
    viewRef.current = { pan: { x: 0, y: 0 }, zoom: 1 };
    selectedNodeRef.current = null;
    render();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: 'grab', background: 'transparent' }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0000001a" />
          </filter>
          <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.8" fill="#cbd5e1" />
          </pattern>
        </defs>
        <rect className="svg-bg" width="100%" height="100%" fill="url(#dots)" />
        <g className="pipeline-content" />
      </svg>

      {steps.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">工作流图将在规划完成后显示</p>
          <p className="text-slate-300 text-xs mt-1">支持平移、缩放和节点拖拽</p>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 p-0.5">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title="缩小"
          >
            <ZoomOut size={13} className="text-slate-600" />
          </button>
          <span className="text-xs text-slate-600 min-w-[38px] text-center font-medium tabular-nums">
            {zoomDisplay}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title="放大"
          >
            <ZoomIn size={13} className="text-slate-600" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 p-0.5">
          <button
            onClick={fitView}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title="适应视图"
          >
            <Maximize2 size={13} className="text-slate-600" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title="重置视图"
          >
            <RotateCcw size={13} className="text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
