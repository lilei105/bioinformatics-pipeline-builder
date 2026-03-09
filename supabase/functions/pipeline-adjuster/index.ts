import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `你是一个生物信息学流程调整助手。
用户已有一个规划好的分析流程，现在想用自然语言对其进行调整。

你的任务是：分析用户的调整意图，从以下五种操作中选择最合适的一种，并返回结构化指令：

操作类型说明：
1. "replan" - 完整重新规划。当用户的起始数据或目标发生根本性变化时使用。
   返回新的 new_start_types 和 new_goal_types。

2. "add_goal" - 追加新目标。当用户想在现有流程基础上额外增加分析内容时使用。
   返回新增的 new_goal_types（只返回新增的，不包含已有的目标）。

3. "remove_step" - 删除步骤。当用户想移除某个或某些分析步骤时使用。
   返回 remove_tool_ids 列表（工具ID，如 "cutadapt", "dada2", "blastn"）。

4. "update_start" - 更新起始数据。当用户说“我已经有了XXX”或“跳过XXX步骤，从 XXX 开始”时使用。
   返回新的 new_start_types（完整替换原有起始类型）。

5. "reorder" - 调整步骤顺序。当用户明确要求将某个工具移到另一个工具的前面或后面，
   或者交换两个步骤的位置时使用。触发重新规划，但会按照用户期望的相对顺序约束调度。
   返回 reordered_step_ids：只需包含用户明确指定了相对顺序的那几个工具ID，
   按用户期望的相对顺序排列。不要包含用户没有提及的其他工具——让规划器自动决定它们的并行或串行关系。
   例如：用户说“把 alpha_diversity 放到 even 之后” → 返回 ["even", "alpha_diversity"]
   例如：用户说“先做 A，再做 B，然后做 C” → 返回 ["A", "B", "C"]
   例如：用户说“把 X 和 Y 对调” → 返回 ["Y", "X"]（原来 X 在前，现在 Y 在前）

选择规则（按优先级）：
- 用户说“把X移到Y前/后”、“X和Y换一下顺序”、“先做X再做Y” → 使用 reorder
- 用户说“去掉/删除/移除X” → 使用 remove_step
- 用户说“我已经有了X”、“跳过X，从 Y 开始” → 使用 update_start
- 用户说“再加一个X分析” → 使用 add_goal
- 起始数据或最终目标发生根本变化 → 使用 replan
- 根据用户意图选择最小化改动的操作
- reorder 操作：reordered_step_ids 只包含用户明确提到的工具，不要添加其他工具

必须返回合法的 JSON，不要加任何额外说明。

返回格式（只返回 JSON）：
{
  "action": "replan" | "add_goal" | "remove_step" | "update_start" | "reorder",
  "reasoning": "一句话解释选择此操作的原因",
  "new_start_types": [],
  "new_goal_types": [],
  "remove_tool_ids": [],
  "reordered_step_ids": []
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      user_adjustment,
      original_intent,
      current_start_types,
      current_goal_types,
      current_step_ids,
      semantic_types,
      llm_api_key,
      llm_base_url,
      llm_model,
    } = body;

    if (!user_adjustment || !Array.isArray(semantic_types)) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数: user_adjustment 或 semantic_types" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("SILICONFLOW_API_KEY") ?? llm_api_key;
    const baseUrl = Deno.env.get("SILICONFLOW_BASE_URL") ?? llm_base_url ?? "https://api.siliconflow.cn/v1";
    const model = Deno.env.get("SILICONFLOW_MODEL") ?? llm_model ?? "Pro/MiniMaxAI/MiniMax-M2.5";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "未配置 LLM API Key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typeList = semantic_types.join("\n- ");
    const stepList = Array.isArray(current_step_ids) ? current_step_ids.join(", ") : "";

    const userPrompt = `原始分析需求：${original_intent ?? "未知"}

当前流程信息：
- 起始数据类型：${(current_start_types ?? []).join(", ")}
- 目标结果类型：${(current_goal_types ?? []).join(", ")}
- 当前步骤中的工具ID列表（按执行顺序）：${stepList}

可用的语义类型列表：
- ${typeList}

用户的调整需求：
${user_adjustment}

请分析用户意图，选择合适的操作类型并返回 JSON（只返回 JSON，不要其他内容）：
{
  "action": "replan" | "add_goal" | "remove_step" | "update_start" | "reorder",
  "reasoning": "解释原因",
  "new_start_types": [],
  "new_goal_types": [],
  "remove_tool_ids": [],
  "reordered_step_ids": []
}

注意：如果是 reorder 操作，reordered_step_ids 只需包含用户明确指定了顺序关系的那几个工具ID（按用户期望的相对顺序），不要包含其他工具。例如用户说“把 alpha_diversity 放到 even 之后”，则返回 ["even", "alpha_diversity"]，不要添加其他工具。`;

    const llmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      return new Response(
        JSON.stringify({ error: `LLM API 调用失败: ${llmRes.status} - ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmData = await llmRes.json();
    const content = llmData.choices?.[0]?.message?.content ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: `LLM 返回内容无法解析为 JSON: ${content}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const validActions = ["replan", "add_goal", "remove_step", "update_start", "reorder"];
    if (!validActions.includes(parsed.action)) {
      return new Response(
        JSON.stringify({ error: `无效的操作类型: ${parsed.action}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = {
      action: parsed.action as string,
      reasoning: parsed.reasoning as string ?? "",
      new_start_types: Array.isArray(parsed.new_start_types) ? parsed.new_start_types as string[] : [],
      new_goal_types: Array.isArray(parsed.new_goal_types) ? parsed.new_goal_types as string[] : [],
      remove_tool_ids: Array.isArray(parsed.remove_tool_ids) ? parsed.remove_tool_ids as string[] : [],
      reordered_step_ids: Array.isArray(parsed.reordered_step_ids) ? parsed.reordered_step_ids as string[] : [],
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
