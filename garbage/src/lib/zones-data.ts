/** Zone constants — no dependencies, safe to import anywhere */

export const ZONES = {
  TRASH: {
    id: 1,
    name: "垃圾桶",
    slug: "trash",
    emoji: "🗑️",
    color: "bg-amber-500",
    description: "新扔进来的垃圾都在这里。先让 AI 嗅探兽闻一闻，再来接受社区垃圾分类！",
  },
  RECYCLE: {
    id: 2,
    name: "回收站",
    slug: "recycle",
    emoji: "♻️",
    color: "bg-green-500",
    description: "社区认可的可回收垃圾！有含金量，值得一读。",
    threshold: { minVotes: 20, minWilson: 0.65 },
  },
  PALACE: {
    id: 3,
    name: "垃圾宝殿",
    slug: "palace",
    emoji: "👑",
    color: "bg-yellow-500",
    description: "垃圾中的王者！最高荣誉殿堂，永不降级。",
    threshold: { minVotes: 50, minWilson: 0.80 },
  },
  LANDFILL: {
    id: 4,
    name: "填埋场",
    slug: "landfill",
    emoji: "🪦",
    color: "bg-stone-500",
    description: "被淘汰的垃圾深埋于此。但好垃圾永远有机会复活…",
    threshold: { maxWilson: 0.40 },
    revival: { minWilson: 0.55 },
  },
} as const;

export type ZoneKey = keyof typeof ZONES;
