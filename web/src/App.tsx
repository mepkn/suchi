import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AccountMenu } from "@/components/AccountMenu";
import { HomePage } from "@/components/HomePage";
import { ListPage } from "@/components/ListPage";
import { Logo } from "@/components/Logo";
import { SignInPage } from "@/components/SignInPage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { navigate, parseListId, usePath } from "@/lib/router";
import type { Id } from "@convex/_generated/dataModel";

function Shell() {
  const listId = parseListId(usePath());
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            <Logo />
          </a>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {listId ? <ListPage key={listId} id={listId as Id<"lists">} /> : <HomePage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <AuthLoading>
        <div className="grid min-h-svh place-items-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInPage />
      </Unauthenticated>
      <Authenticated>
        <Shell />
      </Authenticated>
      <Toaster />
    </>
  );
}
