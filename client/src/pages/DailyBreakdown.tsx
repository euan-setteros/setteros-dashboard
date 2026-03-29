import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Bell } from "lucide-react";
import { useState, useMemo } from "react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatWeekRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-GB", opts)} - ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

function getDaysOfWeek(weekStart: string): string[] {
  const start = new Date(weekStart);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

export default function DailyBreakdown() {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data, isLoading } = trpc.leaderboard.dailyBreakdown.useQuery(
    { weekOffset },
    { refetchInterval: 60000 }
  );

  const { data: leaderboardData } = trpc.leaderboard.weekly.useQuery(
    { weekOffset },
    { refetchInterval: 60000 }
  );

  const weekLabel = useMemo(() => {
    if (!data) return "";
    return formatWeekRange(data.weekStart, data.weekEnd);
  }, [data]);

  const days = useMemo(() => {
    if (!data) return [];
    return getDaysOfWeek(data.weekStart);
  }, [data]);

  // Build a matrix: setter -> day -> bells
  const matrix = useMemo(() => {
    if (!data || !leaderboardData) return [];

    const setterMap = new Map<number, { displayName: string; days: Record<string, number>; total: number }>();

    // Initialize from leaderboard for ordering
    for (const entry of leaderboardData.leaderboard) {
      setterMap.set(entry.setterId, {
        displayName: entry.displayName,
        days: {},
        total: entry.totalBells,
      });
    }

    // Fill in daily data
    for (const entry of data.breakdown) {
      const setter = setterMap.get(entry.setterId);
      if (setter) {
        setter.days[entry.date] = entry.bells;
      }
    }

    return Array.from(setterMap.values()).sort((a, b) => b.total - a.total);
  }, [data, leaderboardData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Breakdown</h1>
          <p className="text-sm text-muted-foreground mt-1">
            See how many meetings each setter booked per day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset(w => w - 1)}
            disabled={weekOffset <= -52}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium text-foreground min-w-[180px] text-center">
            {isLoading ? "Loading..." : weekLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={weekOffset >= 0}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
              className="text-xs text-primary"
            >
              This Week
            </Button>
          )}
        </div>
      </div>

      {/* Daily Grid */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Daily Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !matrix.length ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No data for this week.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[140px]">
                      Setter
                    </th>
                    {days.map((day, i) => {
                      const d = new Date(day + "T00:00:00Z");
                      const isToday = day === new Date().toISOString().split("T")[0];
                      return (
                        <th
                          key={day}
                          className={`text-center py-3 px-2 text-xs font-medium uppercase tracking-wider min-w-[60px] ${
                            isToday ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          <div>{DAY_NAMES[i]}</div>
                          <div className="text-[10px] font-normal mt-0.5">
                            {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((setter, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-medium text-sm text-foreground">{setter.displayName}</span>
                      </td>
                      {days.map((day) => {
                        const count = setter.days[day] || 0;
                        return (
                          <td key={day} className="text-center py-3 px-2">
                            {count > 0 ? (
                              <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary/15 text-primary font-bold text-sm">
                                {count}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-sm">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center py-3 px-3">
                        <span className="font-bold text-foreground text-lg">{setter.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
