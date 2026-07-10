import { AUTHOR_TITLES, VOTER_TITLES, COMMENTER_TITLES, getTitle } from "@/lib/rankings";

type BadgeType = "author" | "voter" | "commenter";

interface UserBadgeProps {
  type: BadgeType;
  count: number;
  size?: "sm" | "md";
}

export default function UserBadge({ type, count, size = "sm" }: UserBadgeProps) {
  const titles = type === "author" ? AUTHOR_TITLES : type === "voter" ? VOTER_TITLES : COMMENTER_TITLES;
  const title = getTitle(count, titles);

  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${sizeClass} rounded-full ${title.color} bg-white border border-gray-200 font-medium`}
      title={`${title.title} (${count} ${type === "author" ? "篇投稿" : type === "voter" ? "次投票" : "条评论"})`}
    >
      {title.suffix} {title.title}
    </span>
  );
}

/** Get the author title info for an author name (server-side) */
export function getAuthorTitleInfo(count: number) {
  return getTitle(count, AUTHOR_TITLES);
}

export function getVoterTitleInfo(count: number) {
  return getTitle(count, VOTER_TITLES);
}

export function getCommenterTitleInfo(count: number) {
  return getTitle(count, COMMENTER_TITLES);
}
