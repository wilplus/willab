"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, getAccessToken } from "@/lib/supabase";
import { SITE_NAME } from "@/lib/site";

const BOOK_LESSON_URL = "https://calendly.com"; // replace with your booking link
const SUPPORT_EMAIL = "artur@willonski.com";

export function Navbar() {
  const router = useRouter();
  const [isCoach, setIsCoach] = useState<boolean | null>(null);

  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) {
        setIsCoach(false);
        return;
      }
      fetch("/api/admin/check", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => setIsCoach(res.ok))
        .catch(() => setIsCoach(false));
    });
  }, []);

  async function handleLogout() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
      <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/homework" className="text-lg font-medium text-gray-900">
          {SITE_NAME}
        </Link>
        <div className="flex items-center gap-4">
          {isCoach === true && (
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
              Admin
            </Link>
          )}
          <a
            href={BOOK_LESSON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Book a Lesson
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Contact Support
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}
