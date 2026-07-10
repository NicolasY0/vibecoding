import { prisma } from "./prisma";
import { wilsonScoreFromStars } from "./wilson";
export { ZONES } from "./zones-data";
export type { ZoneKey } from "./zones-data";
import { ZONES } from "./zones-data";

/**
 * Determine which zone an article should be in based on its current zone,
 * Wilson score, and vote count.
 */
export function determineZone(
  currentZoneId: number,
  totalVotes: number,
  avgScore: number
): number {
  const wilson = wilsonScoreFromStars(totalVotes, avgScore);

  // Palace articles are NEVER demoted
  if (currentZoneId === ZONES.PALACE.id) {
    return ZONES.PALACE.id;
  }

  // Promotion: TRASH → RECYCLE
  if (currentZoneId === ZONES.TRASH.id) {
    if (totalVotes >= 20 && wilson >= 0.65) {
      return ZONES.RECYCLE.id;
    }
    if (totalVotes >= 20 && wilson < 0.40) {
      return ZONES.LANDFILL.id;
    }
    return ZONES.TRASH.id;
  }

  // Promotion: RECYCLE → PALACE
  if (currentZoneId === ZONES.RECYCLE.id) {
    if (totalVotes >= 50 && wilson >= 0.80) {
      return ZONES.PALACE.id;
    }
    if (totalVotes >= 30 && wilson < 0.40) {
      return ZONES.LANDFILL.id;
    }
    return ZONES.RECYCLE.id;
  }

  // Revival: LANDFILL → RECYCLE
  if (currentZoneId === ZONES.LANDFILL.id) {
    if (wilson >= 0.55 && totalVotes >= 30) {
      return ZONES.RECYCLE.id;
    }
    return ZONES.LANDFILL.id;
  }

  return ZONES.TRASH.id;
}

/**
 * Get zone info by slug for display
 */
export function getZoneBySlug(slug: string) {
  const zone = Object.values(ZONES).find((z) => z.slug === slug);
  return zone || ZONES.TRASH;
}

/**
 * Get zone info by id
 */
export function getZoneById(id: number) {
  const zone = Object.values(ZONES).find((z) => z.id === id);
  return zone || ZONES.TRASH;
}

/**
 * After a vote is cast, update the article's score and zone
 */
export async function updateArticleZone(articleId: number) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      upvotes: true,
      downvotes: true,
      totalVotes: true,
      zoneId: true,
    },
  });

  if (!article) return;

  const avgScore =
    article.totalVotes > 0
      ? (article.upvotes * 5 + article.downvotes * 1) / article.totalVotes
      : 3;

  const newZoneId = determineZone(
    article.zoneId,
    article.totalVotes,
    avgScore
  );
  const wilson = wilsonScoreFromStars(article.totalVotes, avgScore);

  await prisma.article.update({
    where: { id: articleId },
    data: {
      wilsonScore: wilson,
      zoneId: newZoneId,
    },
  });

  return { newZoneId, wilson, avgScore };
}
