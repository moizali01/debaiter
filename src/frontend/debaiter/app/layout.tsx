import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { getServerSession } from 'next-auth';
import './globals.css';
import SessionProvider from './components/SessionProvider';
import NavMenu from './components/NavMenu';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Debaiter',
  description: 'Welcome to Debaiter',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  return (
    <html lang="en" className="h-full bg-zinc-50 dark:bg-black">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <SessionProvider session={session}>
          {/* We create a full-page layout wrapper */}
          <div className="flex min-h-full flex-col">
            {/* 1. Header: NavMenu is now outside and above main */}
            <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
              <div className="mx-auto max-w-5xl px-4">
                <NavMenu />
              </div>
            </header>

            {/* 2. Main: This is where your page content will go */}
            <main className="mx-auto w-full max-w-5xl flex-grow px-4">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}