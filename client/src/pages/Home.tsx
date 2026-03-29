import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, ChevronLeft, ChevronRight, Trophy, Users, Target, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

const RANK_STYLES: Record<number, { bg: string; text: string; icon: string }> = {
  1: { bg: "bg-[oklch(0.82_0.15_85/0.15)]", text: "text-[oklch(0.82_0.15_85)]", icon: "text-[oklch(0.82_0.15_85)]" },
  2: { bg: "bg-[oklch(0.75_0.01_260/0.12)]", text: "text-[oklch(0.75_0.01_260)]", icon: "text-[oklch(0.75_0.01_260)]" },
  3: { bg: "bg-[oklch(0.65_0.1_55/0.12)]", text: "text-[oklch(0.65_0.1_55)]", icon: "text-[oklch(0.65_0.1_55)]" },
};

function formatWeekRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-GB", opts)} - ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLES[rank];
  if (style) {
    return (
      <div className={`h-10 w-10 rounded-xl ${style.bg} flex items-center justify-center`}>
        <Trophy className={`h-5 w-5 ${style.icon}`} />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
      <span className="text-sm font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data, isLoading } = trpc.leaderboard.weekly.useQuery(
    { weekOffset },
    { refetchInterval: 60000 }
  );

  const weekLabel = useMemo(() => {
    if (!data) return "";
    return formatWeekRange(data.weekStart, data.weekEnd);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Weekly Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meetings booked this week, tracked by bell emojis in Slack
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Meetings</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : data?.teamTotals.totalBells ?? 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Setters</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : data?.teamTotals.activeSetters ?? 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bell Posts</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : data?.teamTotals.totalMessages ?? 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !data?.leaderboard.length ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No bells recorded for this week yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bells will appear once setters post in #setteros-community
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.leaderboard.map((entry) => {
                const rankStyle = RANK_STYLES[entry.rank];
                return (
                  <div
                    key={entry.setterId}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                      rankStyle ? rankStyle.bg : "hover:bg-muted/50"
                    }`}
                  >
                    <RankBadge rank={entry.rank} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {entry.displayName}
                      </p>
                      {entry.realName && entry.realName !== entry.displayName && (
                        <p className="text-xs text-muted-foreground">{entry.realName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{entry.totalBells}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.totalBells === 1 ? "meeting" : "meetings"}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.min(entry.totalBells, 5) }).map((_, i) => (
                          <Bell key={i} className="h-3.5 w-3.5 text-primary" />
                        ))}
                        {entry.totalBells > 5 && (
                          <span className="text-xs text-primary ml-0.5">+{entry.totalBells - 5}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
