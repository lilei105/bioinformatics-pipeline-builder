export interface InputPort {
  id: string;
  description: string;
  semantic: string;
  format: string;
  required: boolean;
  aggregationInput?: boolean;
  aggregationFrom?: string;
}

export interface OutputPort {
  id: string;
  description: string;
  semantic: string;
  format: string;
  filenameTemplate?: string;
  aggregationOutput?: boolean;
}

export interface Parameter {
  id: string;
  description: string;
  type: string;
  required: boolean;
  default: string | number | boolean;
  cliFlag?: string;
}

export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  inputs: InputPort[];
  outputs: OutputPort[];
}

export interface ToolFull extends ToolSummary {
  version: string;
  parameters: Parameter[];
  scriptTemplate: string;
}

export interface PlannerResult {
  steps: PlannedStep[];
  requiredExternal: ExternalRequirement[];
  allAvailableTypes: string[];
}

export type PlannedStep =
  | { kind: 'tool'; toolId: string }
  | { kind: 'aggregate'; fromType: string; toType: string }
  | { kind: 'parallel'; toolIds: string[] };

export interface ExternalRequirement {
  semantic: string;
  description: string;
  example: string;
}
