const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const LLM_API_KEY = import.meta.env.VITE_LLM_API_KEY as string;
const LLM_BASE_URL = import.meta.env.VITE_LLM_BASE_URL as string;
const LLM_MODEL = import.meta.env.VITE_LLM_MODEL as string;

export interface IntentResult {
  start_types: string[];
  goal_types: string[];
}

export async function parseIntent(
  userInput: string,
  semanticTypes: string[]
): Promise<IntentResult> {
  const url = `${SUPABASE_URL}/functions/v1/intent-parser`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_input: userInput,
      semantic_types: semanticTypes,
      llm_api_key: LLM_API_KEY,
      llm_base_url: LLM_BASE_URL,
      llm_model: LLM_MODEL,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`意图解析失败: ${res.status} - ${errText}`);
  }

  const data = await res.json();

  if (!data.start_types || !data.goal_types) {
    throw new Error('LLM 返回格式错误，请重试');
  }

  return {
    start_types: data.start_types as string[],
    goal_types: data.goal_types as string[],
  };
}
