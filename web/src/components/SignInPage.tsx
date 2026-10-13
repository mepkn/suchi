import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Flow = "signIn" | "signUp";

function friendly(err: unknown, flow: Flow): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/allowlist/i.test(raw)) return "This email is not on the allowlist.";
  if (/valid email/i.test(raw)) return "Enter a valid email address.";
  if (/InvalidSecret|InvalidAccountId|Invalid password/i.test(raw)) return "Wrong email or password.";
  if (/already exists/i.test(raw)) return "An account with this email already exists. Sign in instead.";
  if (/password/i.test(raw) && flow === "signUp") return "Password must be at least 8 characters.";
  return flow === "signIn" ? "Could not sign in. Check your email and password." : "Could not create the account.";
}

/** Email + password. Sign-up only works for allowlisted emails. */
export function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<Flow>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
    } catch (err) {
      setError(friendly(err, flow));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex w-full flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-lg font-semibold">{flow === "signIn" ? "Sign in" : "Create account"}</h1>
            <p className="text-sm text-muted-foreground">
              {flow === "signIn" ? "Sign in to see your lists." : "Only emails on the allowlist can sign up."}
            </p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              {flow === "signIn" ? "Sign in" : "Create account"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => {
                setFlow(flow === "signIn" ? "signUp" : "signIn");
                setError(null);
              }}
            >
              {flow === "signIn" ? "First time? Create your account" : "Already have an account? Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
