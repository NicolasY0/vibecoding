import { v4 as uuidv4 } from "uuid";

/**
 * Generate a URL-safe slug from a title (Chinese + English)
 */
export function slugify(title: string): string {
  // For Chinese titles, create a pinyin-friendly slug
  const base = title
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  // Add random suffix to avoid collisions
  const suffix = uuidv4().slice(0, 6);
  return `${base}-${suffix}`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

/**
 * Generate a simple browser fingerprint-like identifier
 * (Not a real fingerprint, just a random ID for anonymous voting)
 */
export function generateVoterFp(): string {
  return uuidv4();
}
