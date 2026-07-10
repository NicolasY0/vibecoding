import { PrismaClient, ReviewStatus } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding garbage database...");

  // Create zones
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { slug: "trash" },
      update: {},
      create: {
        id: 1,
        name: "垃圾桶",
        slug: "trash",
        emoji: "🗑️",
        color: "bg-amber-500",
        description: "新投稿的默认停留区。AI 嗅探兽审核通过后进入社区投票。",
        minScore: 0,
        maxScore: 0.65,
        sortOrder: 1,
      },
    }),
    prisma.zone.upsert({
      where: { slug: "recycle" },
      update: {},
      create: {
        id: 2,
        name: "回收站",
        slug: "recycle",
        emoji: "♻️",
        color: "bg-green-500",
        description: "社区认可的可回收垃圾！值得一读。",
        minScore: 0.65,
        maxScore: 0.80,
        sortOrder: 2,
      },
    }),
    prisma.zone.upsert({
      where: { slug: "palace" },
      update: {},
      create: {
        id: 3,
        name: "垃圾宝殿",
        slug: "palace",
        emoji: "👑",
        color: "bg-yellow-500",
        description: "垃圾中的王者！最高荣誉殿堂，永不降级。",
        minScore: 0.80,
        maxScore: 1.0,
        sortOrder: 3,
      },
    }),
    prisma.zone.upsert({
      where: { slug: "landfill" },
      update: {},
      create: {
        id: 4,
        name: "填埋场",
        slug: "landfill",
        emoji: "🪦",
        color: "bg-stone-500",
        description: "被淘汰的垃圾深埋于此。但好垃圾永远有机会复活...",
        minScore: 0,
        maxScore: 0.40,
        sortOrder: 4,
      },
    }),
  ]);

  console.log("✅ Zones created");

  // Seed articles (well-known S.H.I.T/学术底刊 articles)
  const seedArticles = [
    {
      title: "地府货币膨胀：东亚父母该烧多少钱才能保证孩子不会乱花",
      authorName: "冥币学研究者",
      abstract:
        "本文运用费雪交易方程式，分析了地府冥币通货膨胀对阴阳两界经济的影响。研究发现，东亚父母的烧纸行为与地府冥币的购买力之间存在显著负相关。",
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
      zoneId: 3, // PALACE
      reviewStatus: ReviewStatus.approved,
      reviewScore: 5,
      reviewComment:
        "完美地将宏观经济学应用到阴阳两界，论证严谨，荒诞中透着深刻的洞察。",
      upvotes: 156,
      downvotes: 12,
      totalVotes: 168,
      wilsonScore: 0.87,
    },
    {
      title: "中国青年虚无主义体验的形成机制与生命意义重建路径",
      authorName: "躺平学教授",
      abstract:
        "通过对2000名中国青年的深度访谈，本文系统分析了当代青年虚无主义体验的五种类型及其形成机制。研究发现，\"发疯文学\"和\"吗喽文化\"是青年应对虚无感的主要策略。",
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
      zoneId: 2,
      reviewStatus: ReviewStatus.approved,
      reviewScore: 4,
      reviewComment:
        "对人类学和社会学现象的有趣观察，学术格式尚可，但实证数据可以更严谨。",
      upvotes: 89,
      downvotes: 15,
      totalVotes: 104,
      wilsonScore: 0.76,
    },
    {
      title:
        "嬷一个人，嬷的是他的失权：论同人创作中的权力美学与主体性游戏",
      authorName: "同人文化观察员",
      abstract:
        "本文从福柯权力理论出发，分析同人创作中\"嬷化\"现象的权力维度。研究发现，嬷化本质上是一种通过\"弱化\"来实现\"赋权\"的创造性实践，是粉丝对原作权力结构的微妙颠覆。",
      content: `# 嬷一个人，嬷的是他的失权：论同人创作中的权力美学与主体性游戏

## 摘要

"嬷"（to mommy-fy）是近年同人创作中的重要现象。本文通过对500+篇嬷向同人作品的分析，从福柯、巴特勒和德勒兹的理论框架出发，探讨嬷化行为的美学、政治和哲学意义。

## 1. 什么是"嬷"

简单来说，就是通过创作将被嬷对象重新想象为更具"被保护感"、"脆弱美"或"情感脆弱性"的形象。这种创作行为不是被动的消费，而是对原作权力关系的**主动重写**。

## 2. 理论框架

### 2.1 福柯：权力不是压制，而是生产

嬷化不是"削弱"一个角色——恰恰相反，它在**生产**一种新的权力关系。当粉丝将一个强大的角色重新塑造成需要被保护的形象时，他们实际上是在质疑：什么是真正的"强"？

### 2.2 巴特勒：性别表演与消解

嬷化本质上是一种**跨性别扮演**的创作实践。它通过有意混淆传统的性别气质边界，展示了性别本身的表演性质。

## 3. 结论

嬷化不是对角色的贬低，而是对权力的解构。嬷一个人，嬷的是他的失权——而正是这种"失权"，赋予了创作者真正的权力。`,
      tags: ["文化研究", "同人", "福柯", "性别理论"],
      zoneId: 2,
      reviewStatus: ReviewStatus.approved,
      reviewScore: 5,
      reviewComment:
        "学术功底扎实，将流行文化现象与经典理论巧妙结合，荒诞度略显不足但逻辑性极强。",
      upvotes: 72,
      downvotes: 8,
      totalVotes: 80,
      wilsonScore: 0.82,
    },
    {
      title:
        "基于乌鲁鲁的内裤颜色与堵桥成功率的机制研究",
      authorName: "战术分析师",
      abstract:
        "本文以战术竞技游戏为案例，研究了玩家内裤颜色与\"堵桥\"成功率之间的相关性。通过180次实验收集数据，发现粉色内裤确实提升了堵桥成功率12.7%。",
      content: `# 基于乌鲁鲁的内裤颜色与堵桥成功率的机制研究

## 摘要

本文通过180次控制实验，系统研究了热门战术竞技游戏中角色"乌鲁鲁"的内裤颜色与"堵桥"成功率之间的关系。

## 1. 引言

"堵桥"是战术竞技游戏中的经典战术。但有一个问题长期困扰着玩家社区：**穿什么颜色的内裤堵桥成功率最高？**

## 2. 实验设计

- 控制变量：相同地图、相同武器、相同堵桥位置
- 自变量：内裤颜色（红、蓝、绿、粉、黑、白）
- 因变量：堵桥成功率（击杀经过桥梁的敌人/经过桥梁的敌人总数）
- 每组30次实验，共180次

## 3. 结果

| 内裤颜色 | 堵桥成功率 | p值 |
|---------|-----------|-----|
| 红色 | 62.3% | - |
| 蓝色 | 59.1% | 0.32 |
| 绿色 | 54.7% | 0.08 |
| 粉色 | **71.7%** | **0.01** |
| 黑色 | 60.5% | 0.41 |
| 白色 | 48.2% | 0.02 |

粉色内裤组表现显著优于其他颜色（p<0.05）。

## 4. 讨论

粉色可能通过以下机制提升表现：
1. **视觉干扰假说**：敌人看到粉色会短暂困惑
2. **自信增益假说**：穿粉色让玩家更自信
3. **安慰剂效应**：根本没啥用，但你觉得有用就有用

## 5. 结论

如果你要堵桥，穿粉色。科学证明了。`,
      tags: ["游戏研究", "统计学", "战术分析", "内裤"],
      zoneId: 1,
      reviewStatus: ReviewStatus.approved,
      reviewScore: 4,
      reviewComment:
        "有趣的实验设计，数据看起来有模有样，虽然样本量偏小但结论具有一定参考（娱乐）价值。",
      upvotes: 45,
      downvotes: 6,
      totalVotes: 51,
      wilsonScore: 0.78,
    },
    {
      title:
        "白丝味道指数的跨感官建模与推断",
      authorName: "感官科学家",
      abstract:
        "本文构建了一个跨感官的\"白丝味道指数\"模型，结合了视觉美学评分、触觉质感评级和嗅觉偏好测试。研究结果显示，白色丝袜的视觉吸引力与预期的味觉体验之间存在显著正相关（r=0.73）。",
      content: `# 白丝味道指数的跨感官建模与推断

## 摘要

本文首次提出"白丝味道指数"（White Stocking Taste Index, WSTI）概念，并通过跨感官实验验证其合理性。

## 1. 什么是"味道"

本文所说的"味道"并非化学意义上的味觉刺激，而是**审美经验中的"品味感"**。正如我们说某幅画"很有味道"，我们说的是一种超越单一感官的审美体验。

## 2. 方法论

- 从社交媒体收集了1000张不同风格的白丝图片
- 邀请50位受试者进行视觉审美评分（VAS）
- 同时进行触觉模拟评分（TSS）
- 最后进行预判味觉评分（PTS）

## 3. 发现

VAS与PTS之间的相关性高达**r=0.73**，证明**越好看的白丝，人们越觉得它"味道好"**。

这证实了跨感官美学的基本假设：美是相通的。`,
      tags: ["美学", "感官科学", "建模"],
      zoneId: 1,
      reviewStatus: ReviewStatus.approved,
      reviewScore: 3,
      reviewComment:
        "选题有趣但论证略显单薄，样本量可以更大。逻辑自洽性尚可，但学术严谨度有待提升。",
      upvotes: 28,
      downvotes: 10,
      totalVotes: 38,
      wilsonScore: 0.62,
    },
  ];

  for (const article of seedArticles) {
    await prisma.article.upsert({
      where: { slug: article.title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").slice(0, 60) + "-seed01".slice(0, 6) },
      update: {},
      create: {
        ...article,
        slug:
          article.title
            .toLowerCase()
            .replace(/[^\w一-鿿]+/g, "-")
            .slice(0, 60) +
          "-" +
          Math.random().toString(36).slice(2, 8),
        reviewedBy: "AI嗅探兽",
        viewCount: Math.floor(Math.random() * 500),
      },
    });
  }

  console.log(`✅ ${seedArticles.length} seed articles created`);
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
