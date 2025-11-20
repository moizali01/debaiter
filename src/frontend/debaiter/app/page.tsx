import { getServerSession } from 'next-auth';
import DebateConfig from './components/DebateConfig';

export default async function Home() {
  // const session = await getServerSession();

  return (
    <div className="mt-16 w-full">
        <DebateConfig />
    </div>
      // {session ? (
      //   // If the user is logged in, show the debate config
      // ) : (
      //   // If not logged in, show a welcome message
      //   <div className="text-center">
      //     <h1 className="text-4xl font-bold">Welcome to Debaiter</h1>
      //     <p className="mt-4 text-xl text-zinc-600">
      //       Please sign in to start a debate.
      //     </p>
      //   </div>
      // )}
  );
}
