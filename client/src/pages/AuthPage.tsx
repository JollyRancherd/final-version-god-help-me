import { useState } from "react";
import { Loader2, LockKeyhole, UserRound, Fingerprint, ShieldCheck, TrendingUp } from "lucide-react";
import { useLogin, useRegister } from "@/hooks/use-auth";

interface AuthPageProps {
  onNewUser?: (user: { username: string }) => void;
}

export default function AuthPage({ onNewUser }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const register = useRegister();
  const isBusy = login.isPending || register.isPending;
  const error = login.error?.message || register.error?.message;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { username, password };
    if (mode === "login") {
      await login.mutateAsync(payload);
    } else {
      const result = await register.mutateAsync(payload);
      if (result.isNew && onNewUser) {
        onNewUser({ username: result.username });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <div className="text-center space-y-4 mb-8">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(127,176,255,0.15)]">
            <TrendingUp className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {mode === "login" ? "Welcome back" : "Get started"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {mode === "login"
                ? "Sign in to your budget dashboard"
                : "Create your personal finance account"}
            </p>
          </div>
        </div>

        <div className="glass-panel p-1 flex gap-1">
          <button
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              mode === "login"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("login")}
          >
            Log In
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              mode === "register"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("register")}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Username
            </label>
            <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3.5 bg-card/40 backdrop-blur-sm focus-within:border-primary/50 focus-within:bg-card/60 transition-all">
              <UserRound className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                className="bg-transparent outline-none w-full text-sm placeholder:text-muted-foreground/50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username webauthn"
                placeholder="Enter your username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <div className="flex items-center gap-3 border border-border/30 rounded-2xl px-4 py-3.5 bg-card/40 backdrop-blur-sm focus-within:border-primary/50 focus-within:bg-card/60 transition-all">
              <LockKeyhole className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="password"
                className="bg-transparent outline-none w-full text-sm placeholder:text-muted-foreground/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password webauthn" : "new-password"}
                placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
              />
            </div>
          </div>

          {error ? (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-2xl bg-primary text-primary-foreground font-bold py-4 flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_4px_24px_rgba(127,176,255,0.25)] hover:shadow-[0_4px_32px_rgba(127,176,255,0.35)] transition-all duration-200 text-base mt-2"
          >
            {isBusy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            {mode === "login" ? "Log In Securely" : "Create Account"}
          </button>
        </form>

        <div className="rounded-2xl border border-primary/15 bg-card/30 backdrop-blur-sm p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <Fingerprint className="w-4 h-4 text-primary" />
            Face ID / Touch ID Login
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            On iPhone & iPad, Safari will offer to save your password in iCloud Keychain. Next time you open the app, tap the password field and use <span className="text-primary font-medium">Face ID</span> to fill it in automatically — no typing needed.
          </p>
        </div>
      </div>
    </div>
  );
}
