"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ZONES } from "@/lib/zones";

export default function ZoneNav() {
  const pathname = usePathname();

  const zones = [
    { ...ZONES.TRASH },
    { ...ZONES.RECYCLE },
    { ...ZONES.PALACE },
    { ...ZONES.LANDFILL },
  ];

  return (
    <div className="bg-amber-50 border-b border-amber-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-3 overflow-x-auto">
          <span className="text-xs text-gray-500 font-medium mr-1">
            垃圾分类区：
          </span>
          {zones.map((zone) => {
            const href = `/zone/${zone.slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={zone.slug}
                href={href}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? `${zone.color} text-white shadow-sm`
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {zone.emoji} {zone.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
