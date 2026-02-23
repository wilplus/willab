"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/supabase";

type AuthGuardProps = {
  children: React.ReactNode;
  redirectTo?: string;
};

/**
 * Redirects to login if there is no session. Shows nothing until session is known.
 */
export function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const [mounted, setMounted] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getSession().then((session) => {
      setMounted(true);
      if (session) {
        setAllowed(true);
      } else {
        router.replace(redirectTo);
      }
    });
  }, [redirectTo, router]);

  if (!mounted || !allowed) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
