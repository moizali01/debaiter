// Page Author: Moiz
// Description: Layout component for debate pages that checks user authentication.

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function DebateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session || !session.user) {
    redirect('/');
  }
  return <>{children}</>;
}
