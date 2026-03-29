import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Loader2, Bell } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export default function Trends() {
  const { data, isLoading } = trpc.leaderboard.trend.useQuery(
    { weeksBack: 8 },
    { refetchInterval: 60000 }
  );

  const chartData = (data ?? []).map((entry) => ({
    week: formatWeekLabel(entry.weekStart),
    meetings: entry.totalBells,
    setters: entry.activeSetters,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Performance Trends</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Weekly team performance over the past 8 weeks
        </p>
      </div>

      {/* Meetings Trend */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weekly Meetings Booked
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !chartData.length ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No trend data available yet.</p>
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.012 260)" />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 12 }}
                    axisLine={{ stroke: "oklch(0.25 0.012 260)" }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "oklch(0.6 0.02 260)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.19 0.012 260)",
                      border: "1px solid oklch(0.25 0.012 260)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.005 260)",
                    }}
                    labelStyle={{ color: "oklch(0.93 0.005 260)", fontWeight: 600 }}
                  />
                  <Legend
                    wrapperStyle={{ color: "oklch(0.6 0.02 260)", fontSize: 12 }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="meetings"
                    name="Meetings Booked"
                    fill="oklch(0.78 0.16 75)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="setters"
                    name="Active Setters"
                    stroke="oklch(0.65 0.18 145)"
                    strokeWidth={2}
                    dot={{ fill: "oklch(0.65 0.18 145)", r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Table */}
      {chartData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              Weekly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Week Starting
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Meetings
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Active Setters
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Avg per Setter
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 text-sm font-medium text-foreground">{row.week}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-primary/15 text-primary font-bold text-sm">
                          {row.meetings}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-sm text-foreground">{row.setters}</td>
                      <td className="py-3 px-3 text-center text-sm text-foreground">
                        {row.setters > 0 ? (row.meetings / row.setters).toFixed(1) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
