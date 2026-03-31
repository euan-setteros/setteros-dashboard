import { publicProcedure, adminProcedure, router } from "./trpc";
import { z } from "zod";
import {
  getWeeklyLeaderboard,
  getDailyBreakdown,
  getTeamTotals,
  getWeeklyTrend,
  getAllSetters,
  getAllTimeLeaderboard,
  insertManualAdjustment,
  getManualAdjustments,
  deleteManualAdjustment,
} from "./db";

/** Get the Monday 00:00:00 UTC of the week containing the given date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Get the Sunday 23:59:59 UTC of the week containing the given date */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function getWeekDates(weekOffset: number) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setUTCDate(targetDate.getUTCDate() + weekOffset * 7);
  return {
    weekStart: getWeekStart(targetDate),
    weekEnd: getWeekEnd(targetDate),
  };
}

export const appRouter = router({
  leaderboard: router({
    weekly: publicProcedure
      .input(z.object({ weekOffset: z.number().int().min(-52).max(0).default(0) }))
      .query(async ({ input }) => {
        const { weekStart, weekEnd } = getWeekDates(input.weekOffset);
        const leaderboard = await getWeeklyLeaderboard(weekStart, weekEnd);
        const teamTotals = await getTeamTotals(weekStart, weekEnd);

        return {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          weekOffset: input.weekOffset,
          leaderboard: leaderboard.map((entry, index) => ({
            rank: index + 1,
            setterId: entry.setterId,
            displayName: entry.displayName,
            realName: entry.realName,
            slackUserId: entry.slackUserId,
            totalBells: Number(entry.totalBells),
            messageCount: Number(entry.messageCount),
          })),
          teamTotals: {
            totalBells: Number(teamTotals.totalBells),
            totalMessages: Number(teamTotals.totalMessages),
            activeSetters: Number(teamTotals.activeSetters),
          },
        };
      }),

    allTime: publicProcedure.query(async () => {
      const leaderboard = await getAllTimeLeaderboard();
      return leaderboard.map((entry, index) => ({
        rank: index + 1,
        setterId: entry.setterId,
        displayName: entry.displayName,
        realName: entry.realName,
        slackUserId: entry.slackUserId,
        totalBells: Number(entry.totalBells),
        messageCount: Number(entry.messageCount),
        firstBell: entry.firstBell,
        lastBell: entry.lastBell,
      }));
    }),

    dailyBreakdown: publicProcedure
      .input(z.object({ weekOffset: z.number().int().min(-52).max(0).default(0) }))
      .query(async ({ input }) => {
        const { weekStart, weekEnd } = getWeekDates(input.weekOffset);
        const breakdown = await getDailyBreakdown(weekStart, weekEnd);

        return {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          breakdown: breakdown.map(entry => ({
            setterId: entry.setterId,
            displayName: entry.displayName,
            date: entry.dayDate,
            bells: Number(entry.dailyBells),
          })),
        };
      }),

    trend: publicProcedure
      .input(z.object({ weeksBack: z.number().int().min(1).max(12).default(6) }))
      .query(async ({ input }) => {
        const trend = await getWeeklyTrend(input.weeksBack);
        return trend.map(entry => ({
          weekStart: entry.weekStart,
          totalBells: Number(entry.totalBells),
          activeSetters: Number(entry.activeSetters),
        }));
      }),

    setters: publicProcedure.query(async () => {
      return getAllSetters();
    }),
  }),

  adjustments: router({
    add: adminProcedure
      .input(z.object({
        setterId: z.number().int().positive(),
        adjustmentDate: z.string(),
        targetTotal: z.number().int().min(0),
        adjustmentType: z.enum(["weekly", "alltime"]).default("weekly"),
      }))
      .mutation(async ({ input }) => {
        const adjDate = new Date(input.adjustmentDate);
        let currentTotal = 0;
        if (input.adjustmentType === "weekly") {
          const { weekStart, weekEnd } = getWeekDates(
            Math.round((adjDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
          );
          const leaderboard = await getWeeklyLeaderboard(weekStart, weekEnd);
          const entry = leaderboard.find(e => e.setterId === input.setterId);
          currentTotal = entry ? Number(entry.totalBells) : 0;
        } else {
          const allTime = await getAllTimeLeaderboard();
          const entry = allTime.find(e => e.setterId === input.setterId);
          currentTotal = entry ? Number(entry.totalBells) : 0;
        }
        const bellDelta = input.targetTotal - currentTotal;
        if (bellDelta === 0) return { success: true, delta: 0, message: "No change needed" };
        await insertManualAdjustment({
          setterId: input.setterId,
          adjustmentDate: adjDate,
          bellDelta,
          adjustmentType: input.adjustmentType,
          adjustedBy: "Admin",
        });
        return { success: true, delta: bellDelta, message: `Adjusted by ${bellDelta > 0 ? '+' : ''}${bellDelta}` };
      }),

    list: adminProcedure
      .input(z.object({
        weekOffset: z.number().int().min(-52).max(0).default(0),
        typeFilter: z.enum(["weekly", "alltime"]).optional(),
        showAll: z.boolean().default(false),
      }))
      .query(async ({ input }) => {
        let weekStart: Date | undefined;
        let weekEnd: Date | undefined;
        if (!input.showAll) {
          const dates = getWeekDates(input.weekOffset);
          weekStart = dates.weekStart;
          weekEnd = dates.weekEnd;
        }
        const adjustments = await getManualAdjustments(weekStart, weekEnd, input.typeFilter);
        return adjustments.map(a => ({
          id: a.id,
          setterId: a.setterId,
          displayName: a.displayName,
          adjustmentDate: a.adjustmentDate,
          bellDelta: a.bellDelta,
          adjustmentType: a.adjustmentType,
          reason: a.reason,
          adjustedBy: a.adjustedBy,
          createdAt: a.createdAt,
        }));
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteManualAdjustment(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
