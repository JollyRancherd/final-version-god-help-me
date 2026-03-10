import { useState } from "react";
import { useUpdateSettings } from "@/hooks/use-settings";
import { DollarSign, TrendingDown, Target, Calendar, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";

interface OnboardingProps {
  username: string;
  onComplete: () => void;
}

interface OnboardingData {
  paycheck: string;
  checkingBalance: string;
  nextPayday: string;
  hasDebt: boolean;
  debtAmount: string;
  emergencyGoal: string;
  apartmentGoal: string;
}

const STEPS = [
  { id: 0, title: "Your Paycheck", icon: DollarSign, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  { id: 1, title: "Your Balance", icon: DollarSign, color: "text-success", bg: "bg-success/10 border-success/20" },
  { id: 2, title: "Next Payday", icon: Calendar, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
  { id: 3, title: "Any Debt?", icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  { id: 4, title: "Your Goals", icon: Target, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
];

export default function OnboardingPage({ username, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    paycheck: "",
    checkingBalance: "",
    nextPayday: "",
    hasDebt: false,
    debtAmount: "",
    emergencyGoal: "3000",
    apartmentGoal: "5000",
  });
  const updateSettings = useUpdateSettings();

  const update = (field: keyof OnboardingData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const canContinue = () => {
    if (step === 0) return data.paycheck !== "" && Number(data.paycheck) > 0;
    if (step === 1) return data.checkingBalance !== "";
    if (step === 2) return data.nextPayday !== "";
    if (step === 3) return !data.hasDebt || (data.debtAmount !== "" && Number(data.debtAmount) >= 0);
    return true;
  };

  const finish = async () => {
    const debtTotal = data.hasDebt && Number(data.debtAmount) > 0 ? Number(data.debtAmount).toFixed(2) : "0.00";
    await updateSettings.mutateAsync({
      paycheck: Number(data.paycheck).toFixed(2),
      checkingBalance: Number(data.checkingBalance).toFixed(2),
      nextPayday: data.nextPayday,
      emergencyFund: "0",
      apartmentFund: "0",
      debtPaid: "0",
      totalDebt: debtTotal,
      emergencyGoal: Number(data.emergencyGoal || 1000).toFixed(2),
      apartmentGoal: Number(data.apartmentGoal || 3000).toFixed(2),
      phase: Number(debtTotal) > 0 ? 1 : 2,
    } as any);
    onComplete();
  };

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const progressPct = ((step) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Welcome, {username}</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Let's set up your budget</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
        </div>

        <div className="w-full h-1.5 bg-card/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPct + (100 / STEPS.length)}%` }}
          />
        </div>

        <div className="glass-panel p-6 space-y-5">
          <div className={`w-14 h-14 rounded-2xl border ${currentStep.bg} flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${currentStep.color}`} />
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">How much is your paycheck?</h2>
                <p className="text-sm text-muted-foreground mt-1">Enter your take-home pay per paycheck (after taxes).</p>
              </div>
              <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3.5 bg-card/40 focus-within:border-primary/50 transition-all">
                <span className="text-muted-foreground font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="bg-transparent outline-none w-full text-lg font-semibold placeholder:text-muted-foreground/40"
                  placeholder="e.g. 1500"
                  value={data.paycheck}
                  onChange={(e) => update("paycheck", e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">Paid bi-weekly? Enter one paycheck. Monthly? Enter the monthly amount ÷ 2.</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Checking balance right now?</h2>
                <p className="text-sm text-muted-foreground mt-1">This helps calculate how much you have to spend safely.</p>
              </div>
              <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3.5 bg-card/40 focus-within:border-primary/50 transition-all">
                <span className="text-muted-foreground font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="bg-transparent outline-none w-full text-lg font-semibold placeholder:text-muted-foreground/40"
                  placeholder="e.g. 400"
                  value={data.checkingBalance}
                  onChange={(e) => update("checkingBalance", e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">When's your next payday?</h2>
                <p className="text-sm text-muted-foreground mt-1">Used to calculate daily safe-to-spend amounts.</p>
              </div>
              <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3.5 bg-card/40 focus-within:border-primary/50 transition-all">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  className="bg-transparent outline-none w-full text-sm placeholder:text-muted-foreground/40"
                  value={data.nextPayday}
                  onChange={(e) => update("nextPayday", e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Do you have any debt?</h2>
                <p className="text-sm text-muted-foreground mt-1">Credit cards, loans, medical bills — anything you owe.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => update("hasDebt", true)}
                  className={`py-3 rounded-2xl border font-semibold text-sm transition-all ${data.hasDebt ? "bg-destructive/15 border-destructive/40 text-destructive" : "bg-card/40 border-border/20 text-muted-foreground"}`}
                >
                  Yes, I do
                </button>
                <button
                  onClick={() => { update("hasDebt", false); update("debtAmount", "0"); }}
                  className={`py-3 rounded-2xl border font-semibold text-sm transition-all ${!data.hasDebt ? "bg-success/15 border-success/40 text-success" : "bg-card/40 border-border/20 text-muted-foreground"}`}
                >
                  Debt-free!
                </button>
              </div>
              {data.hasDebt && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total debt amount</label>
                  <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3.5 bg-card/40 focus-within:border-destructive/50 transition-all">
                    <span className="text-muted-foreground font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="bg-transparent outline-none w-full text-lg font-semibold placeholder:text-muted-foreground/40"
                      placeholder="e.g. 4500"
                      value={data.debtAmount}
                      onChange={(e) => update("debtAmount", e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Set your savings goals</h2>
                <p className="text-sm text-muted-foreground mt-1">These are the targets the app will track for you. You can change them anytime.</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergency fund target</label>
                  <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3 bg-card/40 focus-within:border-primary/50 transition-all">
                    <span className="text-muted-foreground font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="bg-transparent outline-none w-full text-sm font-semibold placeholder:text-muted-foreground/40"
                      value={data.emergencyGoal}
                      onChange={(e) => update("emergencyGoal", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Savings fund target</label>
                  <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3 bg-card/40 focus-within:border-primary/50 transition-all">
                    <span className="text-muted-foreground font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="bg-transparent outline-none w-full text-sm font-semibold placeholder:text-muted-foreground/40"
                      value={data.apartmentGoal}
                      onChange={(e) => update("apartmentGoal", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border border-border/30 bg-card/40 text-sm font-semibold text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue()}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-[0_4px_24px_rgba(127,176,255,0.25)] disabled:opacity-50 transition-all"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={updateSettings.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-[0_4px_24px_rgba(127,176,255,0.25)] disabled:opacity-50 transition-all"
            >
              {updateSettings.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {updateSettings.isPending ? "Saving..." : "Let's go!"}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">You can update any of this from the app at any time.</p>
      </div>
    </div>
  );
}
