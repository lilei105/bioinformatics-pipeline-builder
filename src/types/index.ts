export type StepType = 'tool' | 'branch' | 'aggregate';

export interface ToolStep {
  type: 'tool';
  tool_id: string;
  display: string;
}

export interface BranchStep {
  type: 'branch';
  branches: string[][];
  display: string;
}

export interface AggregateStep {
  type: 'aggregate';
  from: string;
  to: string;
  display: string;
}

export type PipelineStep = ToolStep | BranchStep | AggregateStep;

export interface ExternalDep {
  type: string;
  name: string;
  description: string;
  example: string;
}

export interface ParseResult {
  success: boolean;
  session_id: string;
  start_types: string[];
  goal_types: string[];
  logs: string[];
}

export interface PlanResult {
  success: boolean;
  session_id: string;
  status: 'planning' | 'completed' | 'need_input' | 'failed';
  planned_steps: PipelineStep[];
  current_tool?: string;
  available_types: string[];
  required_external?: ExternalDep[];
  logs: string[];
  has_more: boolean;
}

export interface GenerateResult {
  success: boolean;
  script: string;
  script_path: string;
  log_path: string;
  logs: string[];
}

export interface SvgNode {
  id: string;
  label: string;
  nodeType: 'tool' | 'branch' | 'aggregate';
  x: number;
  y: number;
  width: number;
  height: number;
  branchIndex: number;
}

export interface SvgEdge {
  id: string;
  source: string;
  target: string;
}

export type WorkflowStatus = 'idle' | 'parsing' | 'planning' | 'need_input' | 'completed' | 'failed' | 'generating' | 'adjusting';

export interface AdjustRecord {
  input: string;
  reasoning: string;
  action: 'replan' | 'add_goal' | 'remove_step' | 'update_start' | 'reorder';
}

export interface FileEntry {
  semantic_type: string;
  label: string;
  path?: string;
  file?: File;
  uploaded?: boolean;
}
