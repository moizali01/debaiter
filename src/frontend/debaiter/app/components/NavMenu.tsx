"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {session.user?.name}
            </p>
          </div>
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || "User avatar"}
              width={32}
              height={32}
              className="h-9 w-9 rounded-full border border-zinc-200 dark:border-zinc-700"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          )}
        </div>
        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />{" "}
        {/* Divider */}
        <button
          onClick={() => signOut()}
          className="text-sm font-medium text-zinc-500 hover:text-red-600 transition-colors dark:text-zinc-400 dark:hover:text-red-400"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn()}
      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      Sign in
    </button>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        isActive
          ? "text-blue-600 dark:text-blue-400"
          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </Link>
  );
}

export default function NavMenu() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Left Side: Logo & Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            Debaiter
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <NavLink href="/lobby">Lobby</NavLink>

              {/* The styled span */}
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30">
                Play against others
              </span>
            </div>

            <NavLink href="/leaderboard">🏆 Leaderboard</NavLink>
            <NavLink href="/my-debates">📊 My Debates</NavLink>
          </nav>
        </div>

        {/* Right Side: Auth */}
        <AuthButton />
      </div>
    </header>
  );
}
