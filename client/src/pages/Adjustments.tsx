import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Bell, Trophy, Calendar, ArrowRight, Lock } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatWeekRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-GB", opts)} - ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    sessionStorage.setItem("admin-pin", pin.trim());
    setError(false);
    onUnlock();
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center text-foreground">
            Admin Access
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Enter the admin PIN to access manual overrides.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(false); }}
            className={error ? "border-destructive" : ""}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">Invalid PIN. Please try again.</p>}
          <Button type="submit" className="w-full">Unlock</Button>
        </form>
        <Button variant="ghost" onClick={() => setLocation("/")} className="text-muted-foreground">
          Back to Leaderboard
        </Button>
      </div>
    </div>
  );
}

export default function Adjustments() {
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem("admin-pin"));

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <AdjustmentsContent />;
}

function AdjustmentsContent() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSetter, setSelectedSetter] = useState<string>("");
  const [targetTotal, setTargetTotal] = useState("0");
  const [adjustmentDate, setAdjustmentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [adjustmentType, setAdjustmentType] = useState<"weekly" | "alltime">("weekly");
  const [viewTab, setViewTab] = useState<string>("weekly");

  const utils = trpc.useUtils();

  const { data: weeklyData } = trpc.leaderboard.weekly.useQuery({ weekOffset });
  const { data: allTimeData } = trpc.leaderboard.allTime.useQuery();
  const { data: settersData } = trpc.leaderboard.setters.useQuery();

  // Weekly adjustments for the selected week
  const { data: weeklyAdjustments, isLoading: weeklyLoading } = trpc.adjustments.list.useQuery({
    weekOffset,
    typeFilter: "weekly" as const,
  });

  // All-time adjustments (no week filter)
  const { data: alltimeAdjustments, isLoading: alltimeLoading } = trpc.adjustments.list.useQuery({
    weekOffset: 0,
    typeFilter: "alltime" as const,
    showAll: true,
  });

  const weekLabel = useMemo(() => {
    if (!weeklyData) return "";
    return formatWeekRange(weeklyData.weekStart, weeklyData.weekEnd);
  }, [weeklyData]);

  // Get the current total for the selected setter based on type
  const currentTotal = useMemo(() => {
    if (!selectedSetter) return null;
    const id = parseInt(selectedSetter);
    if (adjustmentType === "weekly") {
      const entry = weeklyData?.leaderboard.find(e => e.setterId === id);
      return entry?.totalBells ?? 0;
    } else {
      const entry = allTimeData?.find(e => e.setterId === id);
      return entry?.totalBells ?? 0;
    }
  }, [selectedSetter, adjustmentType, weeklyData, allTimeData]);

  const targetNum = parseInt(targetTotal) || 0;
  const delta = currentTotal !== null ? targetNum - currentTotal : null;

  const addMutation = trpc.adjustments.add.useMutation({
    onSuccess: (data) => {
      if (data.delta === 0) {
        toast.info("No change needed — setter already at that total");
      } else {
        toast.success(`Updated! Adjusted by ${data.delta > 0 ? "+" : ""}${data.delta}`);
      }
      utils.adjustments.list.invalidate();
      utils.leaderboard.weekly.invalidate();
      utils.leaderboard.dailyBreakdown.invalidate();
      utils.leaderboard.allTime.invalidate();
      setDialogOpen(false);
      setSelectedSetter("");
      setTargetTotal("0");
      setAdjustmentType("weekly");
    },
    onError: (error) => {
      toast.error(`Failed to add adjustment: ${error.message}`);
    },
  });

  const deleteMutation = trpc.adjustments.delete.useMutation({
    onSuccess: () => {
      toast.success("Adjustment removed");
      utils.adjustments.list.invalidate();
      utils.leaderboard.weekly.invalidate();
      utils.leaderboard.dailyBreakdown.invalidate();
      utils.leaderboard.allTime.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!selectedSetter) {
      toast.error("Please select a setter");
      return;
    }
    addMutation.mutate({
      setterId: parseInt(selectedSetter),
      adjustmentDate: new Date(adjustmentDate).toISOString(),
      targetTotal: targetNum,
      adjustmentType,
    });
  };

  // When setter changes, pre-fill the target total with their current count
  const handleSetterChange = (value: string) => {
    setSelectedSetter(value);
    const id = parseInt(value);
    if (adjustmentType === "weekly") {
      const entry = weeklyData?.leaderboard.find(e => e.setterId === id);
      setTargetTotal(String(entry?.totalBells ?? 0));
    } else {
      const entry = allTimeData?.find(e => e.setterId === id);
      setTargetTotal(String(entry?.totalBells ?? 0));
    }
  };

  // When type changes, update the pre-filled total
  const handleTypeChange = (type: "weekly" | "alltime") => {
    setAdjustmentType(type);
    if (selectedSetter) {
      const id = parseInt(selectedSetter);
      if (type === "weekly") {
        const entry = weeklyData?.leaderboard.find(e => e.setterId === id);
        setTargetTotal(String(entry?.totalBells ?? 0));
      } else {
        const entry = allTimeData?.find(e => e.setterId === id);
        setTargetTotal(String(entry?.totalBells ?? 0));
      }
    }
  };

  const renderAdjustmentItem = (adj: {
    id: number;
    setterId: number;
    displayName: string;
    adjustmentDate: Date;
    bellDelta: number;
    adjustmentType: string;
    reason: string | null;
    adjustedBy: string | null;
  }) => (
    <div
      key={adj.id}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors"
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
        adj.bellDelta > 0 ? "bg-chart-2/15" : "bg-destructive/15"
      }`}>
        <Bell className={`h-5 w-5 ${
          adj.bellDelta > 0 ? "text-chart-2" : "text-destructive"
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground">{adj.displayName}</p>
          <span className={`text-sm font-bold ${
            adj.bellDelta > 0 ? "text-chart-2" : "text-destructive"
          }`}>
            {adj.bellDelta > 0 ? `+${adj.bellDelta}` : adj.bellDelta}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            adj.adjustmentType === "alltime"
              ? "bg-amber-500/15 text-amber-400"
              : "bg-blue-500/15 text-blue-400"
          }`}>
            {adj.adjustmentType === "alltime" ? "All-Time" : "Weekly"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(adj.adjustmentDate).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}
          {adj.adjustedBy ? ` — by ${adj.adjustedBy}` : ""}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => deleteMutation.mutate({ id: adj.id })}
        disabled={deleteMutation.isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Manual Overrides</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set the exact meeting total for a setter — choose weekly (affects that week) or all-time (affects total stats only)
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
            {weekLabel || "Loading..."}
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
        </div>
      </div>

      {/* Add Adjustment */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Set Meeting Total</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the correct total for a setter — the system adjusts automatically
                </p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Set Total
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle>Set Meeting Total</DialogTitle>
                  <DialogDescription>
                    Enter the correct total for a setter. The system will calculate and apply the required adjustment automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Adjustment Type Toggle */}
                  <div className="grid gap-2">
                    <Label>Applies To</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTypeChange("weekly")}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          adjustmentType === "weekly"
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-border bg-background hover:border-muted-foreground/30"
                        }`}
                      >
                        <Calendar className={`h-5 w-5 ${adjustmentType === "weekly" ? "text-blue-400" : "text-muted-foreground"}`} />
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${adjustmentType === "weekly" ? "text-blue-400" : "text-foreground"}`}>
                            Weekly
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Affects weekly + all-time
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange("alltime")}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          adjustmentType === "alltime"
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-border bg-background hover:border-muted-foreground/30"
                        }`}
                      >
                        <Trophy className={`h-5 w-5 ${adjustmentType === "alltime" ? "text-amber-400" : "text-muted-foreground"}`} />
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${adjustmentType === "alltime" ? "text-amber-400" : "text-foreground"}`}>
                            All-Time Only
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Affects all-time only
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Setter</Label>
                    <Select value={selectedSetter} onValueChange={handleSetterChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a setter" />
                      </SelectTrigger>
                      <SelectContent>
                        {(settersData ?? [])
                          .filter(s => s.role === "setter")
                          .map(s => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.displayName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target Total with current → new preview */}
                  <div className="grid gap-2">
                    <Label>
                      {adjustmentType === "weekly" ? "Correct Weekly Total" : "Correct All-Time Total"}
                    </Label>
                    <Input
                      type="number"
                      value={targetTotal}
                      onChange={e => setTargetTotal(e.target.value)}
                      min="0"
                      max="999"
                      placeholder="Enter the correct total"
                    />
                    {selectedSetter && currentTotal !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Current:</span>
                        <span className="font-semibold text-foreground">{currentTotal}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{targetNum}</span>
                        {delta !== null && delta !== 0 && (
                          <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${
                            delta > 0 ? "bg-chart-2/15 text-chart-2" : "bg-destructive/15 text-destructive"
                          }`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                        {delta === 0 && (
                          <span className="text-xs text-muted-foreground italic">no change</span>
                        )}
                      </div>
                    )}
                  </div>

                  {adjustmentType === "weekly" && (
                    <div className="grid gap-2">
                      <Label>Date (within the week)</Label>
                      <Input
                        type="date"
                        value={adjustmentDate}
                        onChange={e => setAdjustmentDate(e.target.value)}
                      />
                    </div>
                  )}

                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={addMutation.isPending || !selectedSetter}
                    className="bg-primary text-primary-foreground"
                  >
                    {addMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save Total"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments List with Tabs */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Override History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={viewTab} onValueChange={setViewTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="weekly" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="alltime" className="gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                All-Time Only
              </TabsTrigger>
            </TabsList>

            <TabsContent value="weekly">
              {weeklyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !weeklyAdjustments?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No weekly overrides for this period</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {weeklyAdjustments.map(renderAdjustmentItem)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="alltime">
              {alltimeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !alltimeAdjustments?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No all-time overrides yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {alltimeAdjustments.map(renderAdjustmentItem)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
