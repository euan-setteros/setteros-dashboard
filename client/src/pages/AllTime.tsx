import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Trophy, Crown, Loader2, Calendar } from "lucide-react";

const RANK_STYLES: Record<number, { bg: string; text: string; icon: string }> = {
  1: { bg: "bg-[oklch(0.82_0.15_85/0.15)]", text: "text-[oklch(0.82_0.15_85)]", icon: "text-[oklch(0.82_0.15_85)]" },
  2: { bg: "bg-[oklch(0.75_0.01_260/0.12)]", text: "text-[oklch(0.75_0.01_260)]", icon: "text-[oklch(0.75_0.01_260)]" },
  3: { bg: "bg-[oklch(0.65_0.1_55/0.12)]", text: "text-[oklch(0.65_0.1_55)]", icon: "text-[oklch(0.65_0.1_55)]" },
};

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLES[rank];
  if (style) {
    return (
      <div className={`h-12 w-12 rounded-xl ${style.bg} flex items-center justify-center`}>
        {rank === 1 ? (
          <Crown className={`h-6 w-6 ${style.icon}`} />
        ) : (
          <Trophy className={`h-5 w-5 ${style.icon}`} />
        )}
      </div>
    );
  }
  return (
    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
      <span className="text-base font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

export default function AllTime() {
  const { data, isLoading } = trpc.leaderboard.allTime.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );

  const totalMeetings = data?.reduce((sum, e) => sum + e.totalBells, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">All-Time Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cumulative meetings booked across all time
        </p>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Meetings (All Time)</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalMeetings}
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Setters</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (data?.length ?? 0)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All-Time Rankings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            All-Time Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !data?.length ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No data recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((entry) => {
                const rankStyle = RANK_STYLES[entry.rank];
                return (
                  <div
                    key={entry.setterId}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      rankStyle ? rankStyle.bg : "hover:bg-muted/50"
                    }`}
                  >
                    <RankBadge rank={entry.rank} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate text-lg">
                        {entry.displayName}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>First: {formatDate(entry.firstBell)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Latest: {formatDate(entry.lastBell)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-3xl font-bold text-foreground">{entry.totalBells}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.totalBells === 1 ? "meeting" : "meetings"}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.min(entry.totalBells, 5) }).map((_, i) => (
                          <Bell key={i} className="h-4 w-4 text-primary" />
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
