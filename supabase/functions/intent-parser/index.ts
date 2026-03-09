import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `你是一个生物信息学流程规划助手。
你的任务是：根据用户的分析需求描述，从提供的【语义类型列表】中，精确识别出：
1. start_types：用户当前已有的数据类型（输入数据）
2. goal_types：用户希望得到的分析结果类型（目标输出）

规则：
- 只能从提供的语义类型列表中选择，不能自造类型名
- start_types 必须是用户明确描述“有”或“拥有”的数据类型
- goal_types 必须是用户明确希望得到的最终结果类型
- 必须返回合法的 JSON，不要加任何额外说明

【输入数据类型中文映射】（从语义类型列表中选择最匹配的）：
- "原始测序数据" / "双端测序" / "双端 reads" / "paired fastq" → RawPairedReads.Forward + RawPairedReads.Reverse
- "单端测序" / "单端 reads" → 只有 RawPairedReads.Forward
- "修剪后的 reads" / "去接头后的 reads" → TrimmedPairedReads.Forward + TrimmedPairedReads.Reverse
- "合并后的 reads" / "拼接后的序列" → MergedReads
- "clean reads" / "质控后的 reads" → CleanReads
- "样本 manifest 文件" / "样本列表" / "manifest" → SampleManifest
- "ASV表" / "特征表" / "丰度表" / "OTU表" / "ASV特征表" → AnnotatedFeatureTable.TXT
- "均一化特征表" / "均一化ASV表" / "rarefied table" → EvenFeatureTable.TXT
- "QZA格式特征表" / "QIIME特征表" → FeatureTable.QZA
- "均一化QZA特征表" / "均一化QIIME特征表" → EvenFeatureTable.QZA
- "BIOM格式特征表" / "feature-table.biom" → GenericBiomTable
- "带注释的BIOM表" / "注释后的特征表" → AnnotatedFeatureTable.BIOM
- "代表序列" / "ASV代表序列" / "rep seqs" / "repseqs"（QZA格式）→ RepresentativeSequences.QZA
- "代表序列" / "ASV代表序列"（FASTA格式）→ RepresentativeSequences.FASTA
- "分类学注释" / "物种注释"（QZA格式）→ Taxonomy.QZA
- "分类学注释" / "物种注释"（TSV格式）→ Taxonomy.TSV
- "进化树"（有根）→ PhylogeneticTree.Rooted
- "进化树"（无根）→ PhylogeneticTree.Unrooted
- "分组信息" / "元数据" / "metadata" / "分组文件" / "样本分组" → SampleGroupInfo
- "相对丰度" / "相对丰度表" → RelativeAbundance（或带层级后缀如 RelativeAbundance.Genus）
- "BIOM文件" → GenericBiomTable
- "通用生物文件" → GenericBioFile
- "QIIME artifact" / "qza文件" → QiimeArtifact
- "查询序列" / "query序列" → QuerySequence.Nucleotide
- "BLAST数据库" → BlastDatabase.Nucleotide
- "参考基因组" → ReferenceGenome
- "参考数据库序列" / "SILVA序列" → ReferenceDatabase.Reads
- "参考数据库分类学" / "SILVA分类" → ReferenceDatabase.Taxonomy

【分析目标类型中文映射】：
- "Alpha多样性" / "alpha多样性指数" / "diversity指数" → AlphaDiversityIndex
- "Beta多样性" / "beta多样性" → DistanceMatrix.BrayCurtis + DistanceMatrix.WeightedUnifrac + DistanceMatrix.UnweightedUnifrac
- "Bray-Curtis距离" / "bray curtis" → DistanceMatrix.BrayCurtis
- "Weighted UniFrac" / "加权unifrac" → DistanceMatrix.WeightedUnifrac
- "Unweighted UniFrac" / "非加权unifrac" → DistanceMatrix.UnweightedUnifrac
- "PCoA分析" / "主坐标分析" / "PCoA图" → PCoAResult
- "PCA分析" / "主成分分析" / "PCA图" → PCAResult
- "Adonis分析" / "置换多元方差分析" / "PERMANOVA" → AdonisResult
- "T检验" / "t-test" / "组间差异" → TtestResult
- "相对丰度" / "物种相对丰度" / "各分类级别丰度" → RelativeAbundance.Kingdom + RelativeAbundance.Phylum + RelativeAbundance.Class + RelativeAbundance.Order + RelativeAbundance.Family + RelativeAbundance.Genus + RelativeAbundance.Species
- "属级相对丰度" → RelativeAbundance.Genus
- "门级相对丰度" → RelativeAbundance.Phylum
- "质控报告" / "QC报告" → QCReport.JSON + QCReport.HTML
- "特征表可视化" / "summarize" → FeatureTableVisualization
- "BLAST比对结果" / "blast结果" → AlignmentResult.Tabular
- "SAM文件" / "比对SAM" → AlignmentResult.SAM
- "BAM文件" / "比对BAM" → AlignmentResult.BAM
- "均一化ASV表（TXT）" → EvenFeatureTable.TXT
- "均一化ASV表（BIOM）" → EvenFeatureTable.BIOM
- "带注释的ASV表" / "add metadata后的表" → AnnotatedFeatureTable.TXT + AnnotatedFeatureTable.BIOM
- "导出文件" / "export" → ExportedDirectory`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_input, semantic_types, llm_api_key, llm_base_url, llm_model } = body;

    if (!user_input || !Array.isArray(semantic_types)) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数: user_input 或 semantic_types" }),
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
    const userPrompt = `可用的语义类型列表：
- ${typeList}

用户的分析需求：
${user_input}

请返回 JSON 格式（只返回 JSON，不要其他内容）：
{
  "start_types": ["类型1", "类型2"],
  "goal_types": ["类型3"]
}`;

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
        max_tokens: 256,
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

    if (!Array.isArray(parsed.start_types) || !Array.isArray(parsed.goal_types)) {
      return new Response(
        JSON.stringify({ error: "LLM 返回的 JSON 缺少必要字段" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validStartTypes = parsed.start_types.filter((t: string) =>
      semantic_types.some((s: string) => s === t || s.startsWith(t + ".") || t.startsWith(s + "."))
    );
    const validGoalTypes = parsed.goal_types.filter((t: string) =>
      semantic_types.some((s: string) => s === t || s.startsWith(t + ".") || t.startsWith(s + "."))
    );

    return new Response(
      JSON.stringify({
        start_types: validStartTypes,
        goal_types: validGoalTypes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
