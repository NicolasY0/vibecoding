// @ts-nocheck
import { mockDb } from "./mock-data";

// Use mock database when no DATABASE_URL is set (development without Supabase)
// eslint-disable-next-line
export const prisma = mockDb as any;

if (typeof window === "undefined") {
  const useMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("your-password");
  if (useMock) {
    console.log("🗑️  Using mock database (no DATABASE_URL configured)");
    console.log("   Set DATABASE_URL in .env.local to use Supabase");
  }
}
