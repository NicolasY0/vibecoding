import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// Use DeepSeek API via OpenAI-compatible endpoint
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
});

const reviewSchema = z.object({
  approved: z.boolean(),
  score: z.number().int().min(1).max(5),
  comment: z.string(),
  originality: z.number().int().min(1).max(5),
  academicFormat: z.number().int().min(1).max(5),
  absurdity: z.number().int().min(1).max(5),
  logicCoherence: z.number().int().min(1).max(5),
  garbageValue: z.number().int().min(1).max(5),
});

export type ReviewResult = z.infer<typeof reviewSchema>;

/**
 * AI Sniffer Beast (嗅探兽) — Reviews an article submission
 * Evaluates the article on originality, humor, logic, and "garbage value"
 */
export async function aiReview(
  title: string,
  abstract: string,
  content: string,
  authorName: string
): Promise<ReviewResult> {
  const prompt = `你是一只"嗅探兽"（审核员），在垃圾学术底刊"garbage"工作。你的任务是用鼻子嗅一嗅刚扔进来的这篇学术垃圾，判断它是否值得被发表。

请从以下维度评分（1-5星）：
- **原创性**：选题是否有新意？还是老生常谈？
- **学术格式**：是否有模有样地模仿了学术论文格式？（摘要、论证、结论等）
- **荒诞度**：是否够幽默、够有想象力？一本正经地胡说八道的能力如何？
- **逻辑自洽**：论证是否"自圆其说"？即使是荒诞的结论，推理过程是否有趣？
- **垃圾值（含金量）**：整体来看，这篇"垃圾"有多大的发表价值？

审核标准：鼓励有创意、有幽默感、格式完整的作品。拒绝纯色情、纯政治煽动、纯人身攻击的内容。

文章信息：
- 标题：${title}
- 作者（拾荒者）：${authorName}
- 摘要：${abstract}
- 正文前2000字：${content.slice(0, 2000)}

请给出你的审核结论。`;

  try {
    const result = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: reviewSchema,
      prompt,
      temperature: 0.7,
    });

    return result.object;
  } catch (error) {
    console.error("AI review failed:", error);
    // Default: approve with moderate score if AI fails
    return {
      approved: true,
      score: 3,
      comment:
        "AI嗅探兽打了个喷嚏（审核服务暂时不可用），默认通过。请社区垃圾分类来评判这篇垃圾的价值吧！",
      originality: 3,
      academicFormat: 3,
      absurdity: 3,
      logicCoherence: 3,
      garbageValue: 3,
    };
  }
}
