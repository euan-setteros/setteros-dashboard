import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  setters, bellEntries, manualAdjustments,
  type InsertManualAdjustment,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL);
    _db = drizzle(client);
  }
  if (!_db) throw new Error("DATABASE_URL not configured");
  return _db;
}

// ============ SETTER HELPERS ============

export async function getAllSetters() {
  const db = getDb();
  return db.select().from(setters).where(eq(setters.isActive, 1));
}

// ============ LEADERBOARD QUERIES ============

export async function getWeeklyLeaderboard(weekStart: Date, weekEnd: Date) {
  const db = getDb();

  const bellResults = await db
    .select({
      setterId: bellEntries.setterId,
      displayName: setters.displayName,
      realName: setters.realName,
      slackUserId: setters.slackUserId,
      totalBells: sql<number>`SUM(${bellEntries.bellCount})`.as("totalBells"),
      messageCount: sql<number>`COUNT(${bellEntries.id})`.as("messageCount"),
    })
    .from(bellEntries)
    .innerJoin(setters, eq(bellEntries.setterId, setters.id))
    .where(and(gte(bellEntries.messageDate, weekStart), lte(bellEntries.messageDate, weekEnd)))
    .groupBy(bellEntries.setterId, setters.displayName, setters.realName, setters.slackUserId);

  const adjustmentResults = await db
    .select({
      setterId: manualAdjustments.setterId,
      totalDelta: sql<number>`SUM(${manualAdjustments.bellDelta})`.as("totalDelta"),
    })
    .from(manualAdjustments)
    .where(and(
      gte(manualAdjustments.adjustmentDate, weekStart),
      lte(manualAdjustments.adjustmentDate, weekEnd),
      eq(manualAdjustments.adjustmentType, "weekly"),
    ))
    .groupBy(manualAdjustments.setterId);

  const adjustmentMap = new Map(adjustmentResults.map(a => [a.setterId, Number(a.totalDelta)]));
  const bellMap = new Map(bellResults.map(b => [b.setterId, { totalBells: Number(b.totalBells), messageCount: Number(b.messageCount) }]));

  const allActiveSetters = await db.select().from(setters).where(
    and(eq(setters.isActive, 1), eq(setters.role, "setter"))
  );

  const combined = allActiveSetters.map(s => ({
    setterId: s.id,
    displayName: s.displayName,
    realName: s.realName,
    slackUserId: s.slackUserId,
    totalBells: (bellMap.get(s.id)?.totalBells ?? 0) + (adjustmentMap.get(s.id) ?? 0),
    messageCount: bellMap.get(s.id)?.messageCount ?? 0,
  }));

  combined.sort((a, b) => {
    if (b.totalBells !== a.totalBells) return b.totalBells - a.totalBells;
    return a.displayName.localeCompare(b.displayName);
  });
  return combined;
}

export async function getDailyBreakdown(weekStart: Date, weekEnd: Date) {
  const db = getDb();

  const result = await db
    .select({
      setterId: bellEntries.setterId,
      displayName: setters.displayName,
      dayDate: sql<string>`DATE(${bellEntries.messageDate})`.as("dayDate"),
      dailyBells: sql<number>`SUM(${bellEntries.bellCount})`.as("dailyBells"),
    })
    .from(bellEntries)
    .innerJoin(setters, eq(bellEntries.setterId, setters.id))
    .where(and(gte(bellEntries.messageDate, weekStart), lte(bellEntries.messageDate, weekEnd)))
    .groupBy(bellEntries.setterId, setters.displayName, sql`DATE(${bellEntries.messageDate})`)
    .orderBy(asc(sql`dayDate`), desc(sql`dailyBells`));

  const adjustments = await db
    .select({
      setterId: manualAdjustments.setterId,
      displayName: setters.displayName,
      dayDate: sql<string>`DATE(${manualAdjustments.adjustmentDate})`.as("dayDate"),
      dailyDelta: sql<number>`SUM(${manualAdjustments.bellDelta})`.as("dailyDelta"),
    })
    .from(manualAdjustments)
    .innerJoin(setters, eq(manualAdjustments.setterId, setters.id))
    .where(and(
      gte(manualAdjustments.adjustmentDate, weekStart),
      lte(manualAdjustments.adjustmentDate, weekEnd),
      eq(manualAdjustments.adjustmentType, "weekly"),
    ))
    .groupBy(manualAdjustments.setterId, setters.displayName, sql`DATE(${manualAdjustments.adjustmentDate})`);

  const merged = new Map<string, { setterId: number; displayName: string; dayDate: string; dailyBells: number }>();

  for (const r of result) {
    const key = `${r.setterId}-${r.dayDate}`;
    merged.set(key, { setterId: r.setterId, displayName: r.displayName, dayDate: r.dayDate, dailyBells: Number(r.dailyBells) });
  }

  for (const a of adjustments) {
    const key = `${a.setterId}-${a.dayDate}`;
    const existing = merged.get(key);
    if (existing) {
      existing.dailyBells += Number(a.dailyDelta);
    } else {
      merged.set(key, { setterId: a.setterId, displayName: a.displayName, dayDate: a.dayDate, dailyBells: Number(a.dailyDelta) });
    }
  }

  return Array.from(merged.values())
    .filter(e => e.dailyBells > 0)
    .sort((a, b) => a.dayDate.localeCompare(b.dayDate) || b.dailyBells - a.dailyBells);
}

export async function getTeamTotals(weekStart: Date, weekEnd: Date) {
  const db = getDb();

  const bellResult = await db
    .select({
      totalBells: sql<number>`COALESCE(SUM(${bellEntries.bellCount}), 0)`.as("totalBells"),
      totalMessages: sql<number>`COUNT(${bellEntries.id})`.as("totalMessages"),
      activeSetters: sql<number>`COUNT(DISTINCT ${bellEntries.setterId})`.as("activeSetters"),
    })
    .from(bellEntries)
    .where(and(gte(bellEntries.messageDate, weekStart), lte(bellEntries.messageDate, weekEnd)));

  const adjResult = await db
    .select({
      totalDelta: sql<number>`COALESCE(SUM(${manualAdjustments.bellDelta}), 0)`.as("totalDelta"),
    })
    .from(manualAdjustments)
    .where(and(
      gte(manualAdjustments.adjustmentDate, weekStart),
      lte(manualAdjustments.adjustmentDate, weekEnd),
      eq(manualAdjustments.adjustmentType, "weekly"),
    ));

  const base = bellResult[0] ?? { totalBells: 0, totalMessages: 0, activeSetters: 0 };
  return {
    totalBells: Number(base.totalBells) + Number(adjResult[0]?.totalDelta ?? 0),
    totalMessages: Number(base.totalMessages),
    activeSetters: Number(base.activeSetters),
  };
}

export async function getWeeklyTrend(weeksBack: number = 4) {
  const db = getDb();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeksBack * 7));

  const result = await db
    .select({
      weekStart: sql<string>`DATE_TRUNC('week', ${bellEntries.messageDate})::date`.as("weekStart"),
      totalBells: sql<number>`SUM(${bellEntries.bellCount})`.as("totalBells"),
      activeSetters: sql<number>`COUNT(DISTINCT ${bellEntries.setterId})`.as("activeSetters"),
    })
    .from(bellEntries)
    .where(gte(bellEntries.messageDate, startDate))
    .groupBy(sql`weekStart`)
    .orderBy(asc(sql`weekStart`));

  return result;
}

export async function getAllTimeLeaderboard() {
  const db = getDb();

  const bellResults = await db
    .select({
      setterId: bellEntries.setterId,
      displayName: setters.displayName,
      realName: setters.realName,
      slackUserId: setters.slackUserId,
      totalBells: sql<number>`SUM(${bellEntries.bellCount})`.as("totalBells"),
      messageCount: sql<number>`COUNT(${bellEntries.id})`.as("messageCount"),
      firstBell: sql<string>`MIN(${bellEntries.messageDate})`.as("firstBell"),
      lastBell: sql<string>`MAX(${bellEntries.messageDate})`.as("lastBell"),
    })
    .from(bellEntries)
    .innerJoin(setters, eq(bellEntries.setterId, setters.id))
    .groupBy(bellEntries.setterId, setters.displayName, setters.realName, setters.slackUserId);

  const adjResults = await db
    .select({
      setterId: manualAdjustments.setterId,
      totalDelta: sql<number>`SUM(${manualAdjustments.bellDelta})`.as("totalDelta"),
    })
    .from(manualAdjustments)
    .groupBy(manualAdjustments.setterId);

  const adjMap = new Map(adjResults.map(a => [a.setterId, Number(a.totalDelta)]));
  const bellMap = new Map(bellResults.map(b => [b.setterId, {
    totalBells: Number(b.totalBells),
    messageCount: Number(b.messageCount),
    firstBell: b.firstBell,
    lastBell: b.lastBell,
  }]));

  const allActiveSetters = await db.select().from(setters).where(
    and(eq(setters.isActive, 1), eq(setters.role, "setter"))
  );

  const combined = allActiveSetters.map(s => {
    const bells = bellMap.get(s.id);
    return {
      setterId: s.id,
      displayName: s.displayName,
      realName: s.realName,
      slackUserId: s.slackUserId,
      totalBells: (bells?.totalBells ?? 0) + (adjMap.get(s.id) ?? 0),
      messageCount: bells?.messageCount ?? 0,
      firstBell: bells?.firstBell ?? null,
      lastBell: bells?.lastBell ?? null,
    };
  });

  combined.sort((a, b) => {
    if (b.totalBells !== a.totalBells) return b.totalBells - a.totalBells;
    return a.displayName.localeCompare(b.displayName);
  });
  return combined;
}

// ============ MANUAL ADJUSTMENT HELPERS ============

export async function insertManualAdjustment(adj: InsertManualAdjustment) {
  const db = getDb();
  await db.insert(manualAdjustments).values(adj);
}

export async function getManualAdjustments(weekStart?: Date, weekEnd?: Date, typeFilter?: "weekly" | "alltime") {
  const db = getDb();

  const conditions = [];
  if (weekStart && weekEnd) {
    conditions.push(gte(manualAdjustments.adjustmentDate, weekStart));
    conditions.push(lte(manualAdjustments.adjustmentDate, weekEnd));
  }
  if (typeFilter) {
    conditions.push(eq(manualAdjustments.adjustmentType, typeFilter));
  }

  return db
    .select({
      id: manualAdjustments.id,
      setterId: manualAdjustments.setterId,
      displayName: setters.displayName,
      adjustmentDate: manualAdjustments.adjustmentDate,
      bellDelta: manualAdjustments.bellDelta,
      adjustmentType: manualAdjustments.adjustmentType,
      reason: manualAdjustments.reason,
      adjustedBy: manualAdjustments.adjustedBy,
      createdAt: manualAdjustments.createdAt,
    })
    .from(manualAdjustments)
    .innerJoin(setters, eq(manualAdjustments.setterId, setters.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(manualAdjustments.createdAt));
}

export async function deleteManualAdjustment(id: number) {
  const db = getDb();
  await db.delete(manualAdjustments).where(eq(manualAdjustments.id, id));
}
