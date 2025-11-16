'use client';

import Link from 'next/link';
import Image from 'next/image';
import { signIn, signOut, useSession } from 'next-auth/react';

function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-3">
        {session.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User avatar'}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full"
          />
        )}
        <span className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:block">
          {session.user?.name}
        </span>
        <button 
          onClick={() => signOut()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    );
  }
  return (
    // Sign In Button
    <button
      onClick={() => signIn()}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
    >
      Sign in
    </button>
  );
}

export default function NavMenu() {
  return (
    <nav className="flex h-16 items-center justify-between">
      {/* App Title / Logo */}
      <Link
        href="/"
        className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white"
      >
        Debaiter
      </Link>

      <AuthButton />
    </nav>
  );
}