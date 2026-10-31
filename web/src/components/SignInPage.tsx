import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "signIn" | "signUp" | "verify" | "forgot" | "reset";

const copy: Record<Step, { title: string; description: string; submit: string }> = {
  signIn: { title: "Sign in", description: "Sign in to see your lists.", submit: "Sign in" },
  signUp: { title: "Create account", description: "Only emails on the allowlist can sign up.", submit: "Create account" },
  verify: { title: "Check your email", description: "Enter the 6-digit code we sent you.", submit: "Verify" },
  forgot: { title: "Reset password", description: "We'll email you a 6-digit code.", submit: "Send code" },
  reset: { title: "Choose a new password", description: "Enter the code from your email.", submit: "Reset password" },
};

// Each step sends one Convex Auth Password flow.
const flows: Record<Step, string> = {
  signIn: "signIn",
  signUp: "signUp",
  verify: "email-verification",
  forgot: "reset",
  reset: "reset-verification",
};

function friendly(err: unknown, step: Step): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/allowlist/i.test(raw)) return "This email is not on the allowlist.";
  if (/valid email/i.test(raw)) return "Enter a valid email address.";
  if (/at least 8/i.test(raw)) return "Password must be at least 8 characters.";
  if (/already exists/i.test(raw)) return "An account with this email already exists. Sign in instead.";
  if (/send the email/i.test(raw)) return "Could not send the email. Try again in a minute.";
  if (step === "verify" || step === "reset") return "That code is wrong or has expired.";
  if (/InvalidSecret|InvalidAccountId|Invalid password/i.test(raw)) return "Wrong email or password.";
  if (step === "forgot") return "Could not send a reset code.";
  return step === "signIn" ? "Could not sign in. Check your email and password." : "Could not create the account.";
}

/**
 * Email + password, with a code by email to verify the address at sign-up
 * (and on sign-in if it never was) and to reset a forgotten password.
 * Sign-up only works for allowlisted emails.
 */
export function SignInPage() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>("signIn");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function go(next: Step) {
    setStep(next);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("email", email);
    formData.set("flow", flows[step]);
    try {
      const { signingIn } = await signIn("password", formData);
      // Not signed in yet means a code was emailed: sign-up, an unverified
      // sign-in, or a reset request.
      if (!signingIn) go(step === "forgot" ? "reset" : "verify");
    } catch (err) {
      setError(friendly(err, step));
    } finally {
      setBusy(false);
    }
  }

  const { title, description, submit: submitLabel } = copy[step];
  const codeStep = step === "verify" || step === "reset";
  const link = "text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex w-full flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{codeStep ? `${description} (${email})` : description}</p>
          </div>
          <form onSubmit={submit} key={step} className="flex flex-col gap-4">
            {!codeStep && (
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            {codeStep && (
              <div className="grid gap-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            )}
            {(step === "signIn" || step === "signUp" || step === "reset") && (
              <div className="grid gap-2">
                <Label htmlFor="password">{step === "reset" ? "New password" : "Password"}</Label>
                <Input
                  id="password"
                  name={step === "reset" ? "newPassword" : "password"}
                  type="password"
                  minLength={8}
                  autoComplete={step === "signIn" ? "current-password" : "new-password"}
                  required
                />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              {submitLabel}
            </Button>
            <div className="flex flex-col items-center gap-2">
              {step === "signIn" && (
                <>
                  <button type="button" className={link} onClick={() => go("forgot")}>
                    Forgot password?
                  </button>
                  <button type="button" className={link} onClick={() => go("signUp")}>
                    First time? Create your account
                  </button>
                </>
              )}
              {step !== "signIn" && (
                <button type="button" className={link} onClick={() => go("signIn")}>
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
