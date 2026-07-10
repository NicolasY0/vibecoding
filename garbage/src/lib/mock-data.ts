// @ts-nocheck
/**
 * In-memory mock database for development without Supabase.
 * All data is stored in memory and resets on server restart.
 */
import { ZONES } from "./zones-data";
import { wilsonScoreFromStars } from "./wilson";

// ---- Types ----
export interface MockArticle {
  id: number;
  title: string;
  slug: string;
  authorName: string;
  abstract: string | null;
  content: string;
  tags: string[];
  zoneId: number;
  upvotes: number;
  downvotes: number;
  wilsonScore: number;
  totalVotes: number;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewComment: string | null;
  reviewScore: number | null;
  reviewedBy: string;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
}

export interface MockVote {
  id: number;
  articleId: number;
  userId: string | null;
  voterFp: string | null;
  score: number;
  createdAt: Date;
}

// ---- In-memory store ----
let articleIdCounter = 100;
let voteIdCounter = 1;
let commentIdCounter = 1;
let topicIdCounter = 1;

const articles: MockArticle[] = [];
const votes: MockVote[] = [];
const mockComments: { id: number; articleId: number; authorName: string; content: string; createdAt: Date }[] = [];
const mockTopics: { id: number; title: string; slug: string; description: string; authorName: string; tags: string[]; paperCount: number; createdAt: Date }[] = [];

// ---- Seed data ----
const seedArticles: Omit<MockArticle, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "地府货币膨胀：东亚父母该烧多少钱才能保证孩子不会乱花",
    slug: "difu-huobi-pengzhang-a3f8c1",
    authorName: "冥币学研究者",
    abstract:
      "本文运用费雪交易方程式，分析了地府冥币通货膨胀对阴阳两界经济的影响。",
    content: `# 地府货币膨胀：东亚父母该烧多少钱才能保证孩子不会乱花

## 摘要

本文运用费雪交易方程式（MV=PT），建立地府通货膨胀模型。通过对东亚地区清明节、中元节等节日的烧纸数据进行分析，我们发现：**过度烧纸导致地府冥币严重贬值**，从而使得祖先在天之灵的购买力大幅下降。

## 1. 引言

"清明时节雨纷纷，路上行人欲断魂。"每逢祭祖节日，东亚父母们便开始了年度最大规模的"货币发行"行为。

但是，当我们烧掉面值一百亿的"冥币"时，有没有想过：**地府的通货膨胀已经严重到什么程度了？**

## 2. 理论模型

基于费雪交易方程式：

$$MV = PT$$

其中：
- M = 冥币流通量（即被烧掉的纸钱总额）
- V = 冥币流通速度（地府经济活跃度）
- P = 地府物价水平
- T = 地府交易总量

## 3. 实证分析

我们收集了2020-2026年间中国三大祭祖节日的烧纸数据：

| 年份 | 清明节烧纸(亿元面值) | 冥币购买力指数 |
|------|---------------------|---------------|
| 2020 | 500 | 100 |
| 2022 | 2000 | 45 |
| 2024 | 8000 | 12 |
| 2026 | 50000 | 1.5 |

**结论：烧得越多，下面越穷。**

## 4. 政策建议

1. 央行（地府分行）应实行量化紧缩政策
2. 父母应该烧更有"价值锚定"的东西——比如烧金条、烧比特币
3. 建立阴阳两界汇率联动机制`,
    tags: ["经济学", "冥币", "通货膨胀", "清明节"],
    zoneId: ZONES.PALACE.id,
    upvotes: 156,
    downvotes: 12,
    totalVotes: 168,
    wilsonScore: 0.87,
    reviewStatus: "approved",
    reviewComment: "完美地将宏观经济学应用到阴阳两界，论证严谨，荒诞中透着深刻的洞察。",
    reviewScore: 5,
    reviewedBy: "AI嗅探兽",
    viewCount: 1288,
    userId: null,
  },
  {
    title: "中国青年虚无主义体验的形成机制与生命意义重建路径",
    slug: "zhongguo-qingnian-xuwuzhuyi-b2d7e3",
    authorName: "躺平学教授",
    abstract: "通过对2000名中国青年的深度访谈，本文系统分析了当代青年虚无主义体验的五种类型。",
    content: `# 中国青年虚无主义体验的形成机制与生命意义重建路径

## 摘要

本文基于2000份有效问卷和50次深度访谈，对中国18-30岁青年的虚无主义体验进行了系统研究。

## 1. 什么是虚无主义体验？

不是"这个世界没有意义"的哲学思辨，而是：
- "早起挤地铁，就为了给老板换辆车"的具体感受
- "考研考公考编三线作战，每条线都是分母"的日常绝望
- "看了一天短视频，已经不记得看了什么"的存在性焦虑

## 2. 五种类型

| 类型 | 比例 | 典型语录 |
|------|------|---------|
| 主动躺平型 | 35% | "我不卷了，你们赢了" |
| 被动内卷型 | 28% | "没办法啊，不卷就被淘汰了" |
| 吗喽型 | 22% | "吗喽的命也是命" |
| 发疯文学型 | 10% | "精神状态良好（已疯）" |
| 彻底摆烂型 | 5% | "毁灭吧，赶紧的" |

## 3. 解决路径

建议将"发疯"纳入医保报销范围。`,
    tags: ["社会学", "虚无主义", "躺平", "发疯文学"],
    zoneId: ZONES.RECYCLE.id,
    upvotes: 89,
    downvotes: 15,
    totalVotes: 104,
    wilsonScore: 0.76,
    reviewStatus: "approved",
    reviewComment: "对人类学和社会学现象的有趣观察，学术格式尚可。",
    reviewScore: 4,
    reviewedBy: "AI嗅探兽",
    viewCount: 956,
    userId: null,
  },
  {
    title: "嬷一个人，嬷的是他的失权：论同人创作中的权力美学与主体性游戏",
    slug: "mo-yigeren-mo-de-shi-ta-de-shiquan-c8f1a2",
    authorName: "同人文化观察员",
    abstract: "本文从福柯权力理论出发，分析同人创作中'嬷化'现象的权力维度。",
    content: `# 嬷一个人，嬷的是他的失权：论同人创作中的权力美学与主体性游戏

## 摘要

"嬷"（to mommy-fy）是近年同人创作中的重要现象。本文通过对500+篇嬷向同人作品的分析，从福柯、巴特勒和德勒兹的理论框架出发，探讨嬷化行为的美学、政治和哲学意义。

## 1. 什么是"嬷"

简单来说，就是通过创作将被嬷对象重新想象为更具"被保护感"、"脆弱美"或"情感脆弱性"的形象。这种创作行为不是被动的消费，而是对原作权力关系的**主动重写**。

## 2. 福柯视角：权力不是压制，而是生产

嬷化不是"削弱"一个角色——恰恰相反，它在**生产**一种新的权力关系。

## 3. 结论

嬷化不是对角色的贬低，而是对权力的解构。嬷一个人，嬷的是他的失权——而正是这种"失权"，赋予了创作者真正的权力。`,
    tags: ["文化研究", "同人", "福柯", "性别理论"],
    zoneId: ZONES.RECYCLE.id,
    upvotes: 72,
    downvotes: 8,
    totalVotes: 80,
    wilsonScore: 0.82,
    reviewStatus: "approved",
    reviewComment: "学术功底扎实，将流行文化现象与经典理论巧妙结合。",
    reviewScore: 5,
    reviewedBy: "AI嗅探兽",
    viewCount: 723,
    userId: null,
  },
  {
    title: "基于乌鲁鲁的内裤颜色与堵桥成功率的机制研究",
    slug: "neiku-yanse-duqiao-chenggonglv-d4e9f5",
    authorName: "战术分析师",
    abstract: "通过180次实验，发现粉色内裤显著提升堵桥成功率12.7%（p<0.05）。",
    content: `# 基于乌鲁鲁的内裤颜色与堵桥成功率的机制研究

## 摘要

本文通过180次控制实验，系统研究了热门战术竞技游戏中角色"乌鲁鲁"的内裤颜色与"堵桥"成功率之间的关系。

## 1. 引言

"堵桥"是战术竞技游戏中的经典战术。但有一个问题长期困扰着玩家社区：**穿什么颜色的内裤堵桥成功率最高？**

## 2. 实验设计

- 控制变量：相同地图、相同武器、相同堵桥位置
- 自变量：内裤颜色（红、蓝、绿、粉、黑、白）
- 每组30次实验，共180次

## 3. 结果

| 内裤颜色 | 堵桥成功率 | p值 |
|---------|-----------|-----|
| 红色 | 62.3% | - |
| 蓝色 | 59.1% | 0.32 |
| 粉色 | **71.7%** | **0.01** |
| 白色 | 48.2% | 0.02 |

粉色内裤组表现显著优于其他颜色（p<0.05）。

## 4. 结论

如果你要堵桥，穿粉色。科学证明了。`,
    tags: ["游戏研究", "统计学", "战术分析", "内裤"],
    zoneId: ZONES.TRASH.id,
    upvotes: 45,
    downvotes: 6,
    totalVotes: 51,
    wilsonScore: 0.78,
    reviewStatus: "approved",
    reviewComment: "有趣的实验设计，数据看起来有模有样。",
    reviewScore: 4,
    reviewedBy: "AI嗅探兽",
    viewCount: 567,
    userId: null,
  },
  {
    title: "白丝味道指数的跨感官建模与推断",
    slug: "baisi-weidao-zhishu-e9a1b6",
    authorName: "感官科学家",
    abstract: "本文构建了一个跨感官的'白丝味道指数'模型，视觉吸引力与预期味觉体验存在显著正相关（r=0.73）。",
    content: `# 白丝味道指数的跨感官建模与推断

## 摘要

本文首次提出"白丝味道指数"（White Stocking Taste Index, WSTI）概念。

## 1. 什么是"味道"

本文所说的"味道"并非化学意义上的味觉刺激，而是**审美经验中的"品味感"**。

## 2. 方法论

- 从社交媒体收集了1000张不同风格的白丝图片
- 邀请50位受试者进行视觉审美评分（VAS）
- 同时进行触觉模拟评分（TSS）
- 最后进行预判味觉评分（PTS）

## 3. 发现

VAS与PTS之间的相关性高达**r=0.73**，证明**越好看的白丝，人们越觉得它"味道好"**。

这证实了跨感官美学的基本假设：美是相通的。`,
    tags: ["美学", "感官科学", "建模"],
    zoneId: ZONES.TRASH.id,
    upvotes: 28,
    downvotes: 10,
    totalVotes: 38,
    wilsonScore: 0.62,
    reviewStatus: "approved",
    reviewComment: "选题有趣但论证略显单薄。",
    reviewScore: 3,
    reviewedBy: "AI嗅探兽",
    viewCount: 334,
    userId: null,
  },
];

// Initialize seed data
function initSeedData() {
  if (articles.length === 0) {
    seedArticles.forEach((a, i) => {
      articles.push({
        ...a,
        id: i + 1,
        createdAt: new Date(Date.now() - (5 - i) * 86400000), // stagger dates
        updatedAt: new Date(),
      });
    });
    articleIdCounter = seedArticles.length + 1;
  }

  if (mockTopics.length === 0) {
    const seedTopics = [
      {
        title: "如何量化评估一个笑话的\"冷\"程度？",
        slug: "ruhe-lianghua-pinggu-xiaohua-lengchengdu",
        description: "建立\"冷度指数\"模型，结合观众反应时间、面部表情变化和\"哈\"指数，对笑话进行多维度量化评估。",
        authorName: "冷学家",
        tags: ["幽默学", "量化分析", "冷度指数"],
      },
      {
        title: "公共厕所排队时间的优化模型研究",
        slug: "gonggong-cesuo-paidui-youhua",
        description: "基于排队论，建立公共厕所坑位分配的优化模型。考虑性别差异、使用时长、紧急程度等因素。",
        authorName: "厕所规划师",
        tags: ["排队论", "公共设施", "优化"],
      },
      {
        title: "短视频推荐算法如何影响当代青年的择偶标准",
        slug: "duanshipin-tuijian-suanfa-zeou",
        description: "探索推荐算法如何潜移默化地塑造年轻人的审美偏好和择偶标准。\"理想型\"变成了算法定义的样子吗？",
        authorName: "数字社会学家",
        tags: ["社会学", "算法", "婚恋"],
      },
      {
        title: "论证\"摸鱼\"是提高工作效率的有效手段",
        slug: "lunzheng-moyu-tigao-gongzuo-xiaolv",
        description: "从认知心理学角度证明：适度摸鱼可以有效恢复注意力，提升整体产出。需要对照组实验数据。",
        authorName: "摸鱼哲学博士",
        tags: ["工作科学", "摸鱼", "效率"],
      },
    ];
    seedTopics.forEach((t) => {
      mockTopics.push({
        ...t,
        id: topicIdCounter++,
        paperCount: 0,
        createdAt: new Date(Date.now() - Math.random() * 7 * 86400000),
      });
    });
  }
}

initSeedData();

// ---- Mock Prisma-like API ----
export const mockDb = {
  article: {
    findMany: async (opts?: {
      where?: Partial<MockArticle>;
      orderBy?: Record<string, string>;
      take?: number;
    }) => {
      let result = [...articles];
      if (opts?.where) {
        result = result.filter((a) =>
          Object.entries(opts.where!).every(([k, v]) =>
            (a as Record<string, unknown>)[k] === v
          )
        );
      }
      if (opts?.orderBy) {
        const [key, dir] = Object.entries(opts.orderBy)[0];
        result.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[key] as number;
          const bVal = (b as Record<string, unknown>)[key] as number;
          return dir === "desc" ? bVal - aVal : aVal - bVal;
        });
      }
      if (opts?.take) result = result.slice(0, opts.take);
      return result;
    },

    findUnique: async (opts: { where: Partial<MockArticle> }) => {
      return articles.find((a) =>
        Object.entries(opts.where).every(([k, v]) => (a as Record<string, unknown>)[k] === v)
      ) || null;
    },

    findFirst: async (opts: { where: Partial<MockArticle> }) => {
      return articles.find((a) =>
        Object.entries(opts.where).every(([k, v]) => (a as Record<string, unknown>)[k] === v)
      ) || null;
    },

    create: async (opts: { data: Partial<MockArticle> & { title: string; slug: string; content: string } }) => {
      const id = opts.data.id || articleIdCounter++;
      const now = new Date();
      const article: MockArticle = {
        ...opts.data,
        id,
        createdAt: opts.data.createdAt || now,
        updatedAt: now,
        zoneId: opts.data.zoneId || ZONES.TRASH.id,
        upvotes: opts.data.upvotes || 0,
        downvotes: opts.data.downvotes || 0,
        wilsonScore: opts.data.wilsonScore || 0,
        totalVotes: opts.data.totalVotes || 0,
        viewCount: opts.data.viewCount || 0,
        reviewStatus: opts.data.reviewStatus || "pending",
        reviewComment: opts.data.reviewComment || null,
        reviewScore: opts.data.reviewScore || null,
        reviewedBy: opts.data.reviewedBy || "AI嗅探兽",
        userId: opts.data.userId || null,
        abstract: opts.data.abstract || null,
        tags: opts.data.tags || [],
      };
      articles.push(article);
      return article;
    },

    update: async (opts: {
      where: Partial<MockArticle>;
      data: Partial<MockArticle>;
    }) => {
      const idx = articles.findIndex((a) =>
        Object.entries(opts.where).every(([k, v]) => (a as Record<string, unknown>)[k] === v)
      );
      if (idx === -1) return null;
      articles[idx] = { ...articles[idx], ...opts.data, updatedAt: new Date() };
      return articles[idx];
    },

    count: async (opts?: { where?: Partial<MockArticle> }) => {
      if (!opts?.where) return articles.length;
      return articles.filter((a) =>
        Object.entries(opts.where!).every(([k, v]) =>
          (a as Record<string, unknown>)[k] === v
        )
      ).length;
    },
  },

  vote: {
    findFirst: async (opts: { where: Partial<MockVote> }) => {
      return votes.find((v) =>
        Object.entries(opts.where).every(
          ([k, w]) => (v as Record<string, unknown>)[k] === w
        )
      ) || null;
    },

    create: async (opts: { data: Omit<MockVote, "id" | "createdAt"> }) => {
      const vote: MockVote = {
        ...opts.data,
        id: voteIdCounter++,
        createdAt: new Date(),
      };
      votes.push(vote);

      // Update article stats
      const article = articles.find((a) => a.id === opts.data.articleId);
      if (article) {
        const isUp = opts.data.score >= 4;
        article.totalVotes += 1;
        if (isUp) article.upvotes += 1;
        else article.downvotes += 1;
        const avgScore =
          (article.upvotes * 5 + article.downvotes * 1) / article.totalVotes;
        article.wilsonScore = wilsonScoreFromStars(article.totalVotes, avgScore);

        // Zone transition
        if (article.zoneId !== ZONES.PALACE.id) {
          if (article.totalVotes >= 50 && article.wilsonScore >= 0.80) {
            article.zoneId = ZONES.PALACE.id;
          } else if (article.totalVotes >= 20 && article.wilsonScore >= 0.65) {
            article.zoneId = ZONES.RECYCLE.id;
          } else if (article.totalVotes >= 20 && article.wilsonScore < 0.40) {
            article.zoneId = ZONES.LANDFILL.id;
          }
        }
      }

      return vote;
    },
  },

  zone: {
    findMany: async () => {
      return Object.values(ZONES).map((z) => ({
        id: z.id,
        name: z.name,
        slug: z.slug,
        description: z.description,
        emoji: z.emoji,
        color: z.color,
        minScore: 0,
        maxScore: 1,
        sortOrder: z.id,
      }));
    },
  },

  $transaction: async (ops: unknown[]) => {
    for (const op of ops as Array<() => Promise<unknown>>) {
      await op();
    }
  },

  comment: {
    create: async (opts: { data: { articleId: number; authorName: string; content: string } }) => {
      const comment = {
        id: commentIdCounter++,
        ...opts.data,
        createdAt: new Date(),
      };
      mockComments.push(comment);
      return comment;
    },

    findMany: async (opts: { where: { articleId: number }; orderBy: { createdAt: string } }) => {
      return mockComments
        .filter((c) => c.articleId === opts.where.articleId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
  },

  topic: {
    findMany: async (opts?: { orderBy?: { createdAt: string }; take?: number }) => {
      let result = [...mockTopics];
      if (opts?.orderBy) {
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (opts?.take) result = result.slice(0, opts.take);
      return result;
    },

    findUnique: async (opts: { where: { slug: string } }) => {
      return mockTopics.find((t) => t.slug === opts.where.slug) || null;
    },

    create: async (opts: { data: { title: string; slug: string; description: string; authorName: string; tags: string[] } }) => {
      const topic = {
        id: topicIdCounter++,
        ...opts.data,
        paperCount: 0,
        createdAt: new Date(),
      };
      mockTopics.push(topic);
      return topic;
    },

    count: async () => mockTopics.length,
  },
};

// Reset (for testing)
export function resetMockDb() {
  articles.length = 0;
  votes.length = 0;
  mockComments.length = 0;
  mockTopics.length = 0;
  articleIdCounter = 100;
  commentIdCounter = 1;
  topicIdCounter = 1;
  voteIdCounter = 1;
  initSeedData();
}
