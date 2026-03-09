const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const LLM_API_KEY = import.meta.env.VITE_LLM_API_KEY as string;
const LLM_BASE_URL = import.meta.env.VITE_LLM_BASE_URL as string;
const LLM_MODEL = import.meta.env.VITE_LLM_MODEL as string;

export interface AdjustInstruction {
  action: 'replan' | 'add_goal' | 'remove_step' | 'update_start' | 'reorder';
  reasoning: string;
  new_start_types: string[];
  new_goal_types: string[];
  remove_tool_ids: string[];
  reordered_step_ids: string[];
}

export async function parseAdjustment(params: {
  userAdjustment: string;
  originalIntent: string;
  currentStartTypes: string[];
  currentGoalTypes: string[];
  currentStepIds: string[];
  semanticTypes: string[];
}): Promise<AdjustInstruction> {
  const url = `${SUPABASE_URL}/functions/v1/pipeline-adjuster`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_adjustment: params.userAdjustment,
      original_intent: params.originalIntent,
      current_start_types: params.currentStartTypes,
      current_goal_types: params.currentGoalTypes,
      current_step_ids: params.currentStepIds,
      semantic_types: params.semanticTypes,
      llm_api_key: LLM_API_KEY,
      llm_base_url: LLM_BASE_URL,
      llm_model: LLM_MODEL,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`调整解析失败: ${res.status} - ${errText}`);
  }

  const data = await res.json();

  if (!data.action) {
    throw new Error('LLM 返回格式错误，请重试');
  }

  return data as AdjustInstruction;
}
