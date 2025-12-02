'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Type for the data coming from your server
type OpenDebate = {
    id: string;
    topic: string;
    creatorRole: 'affirmative' | 'negative';
    creatorName: string;
    createdAt: number;
};

export default function LobbyPage() {
    const [debates, setDebates] = useState<OpenDebate[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDebates = async () => {
        try {
            // 1. Get the base URL from env
            const socketUrl = process.env.NEXT_PUBLIC_SOCKET_HOSTNAME || 'http://localhost:8080';

            // 2. Convert ws:// to http:// (and wss:// to https://)
            const httpUrl = socketUrl.replace('ws://', 'http://').replace('wss://', 'https://');

            // 3. Use the HTTP URL for the fetch request
            const res = await fetch(`${httpUrl}/api/open-debates`);

            if (res.ok) {
                const data = await res.json();
                setDebates(data);
            }
        } catch (error) {
            console.error("Failed to fetch debates", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDebates();
        // Poll every 5 seconds to update the list automatically
        const interval = setInterval(fetchDebates, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-zinc-50 p-6 dark:bg-black">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Live Debate Lobby</h1>
                        <p className="text-zinc-500">Join a debate waiting for an opponent</p>
                    </div>
                    <Link href="/" className="rounded-lg bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black">
                        Create New Debate
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-10">Loading active debates...</div>
                ) : debates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:bg-zinc-900">
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">No active debates found</h3>
                        <p className="text-zinc-500">Why not start one yourself?</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {debates.map((debate) => (
                            <DebateCard key={debate.id} debate={debate} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DebateCard({ debate }: { debate: OpenDebate }) {
    // If creator is affirmative, joiner must be negative
    const myRole = debate.creatorRole === 'affirmative' ? 'negative' : 'affirmative';

    const joinLink = `/debate/${debate.id}?topic=${encodeURIComponent(debate.topic)}&role=${myRole}&opponent=human`;

    return (
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Live & Waiting</span>
                </div>

                <h3 className="text-lg font-bold text-zinc-900 dark:text-white line-clamp-2 mb-2" title={debate.topic}>
                    {debate.topic}
                </h3>

                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Opponent: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{debate.creatorName}</span>
                </p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                    href={joinLink}
                    className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                    Join as {myRole === 'affirmative' ? 'Affirmative' : 'Negative'}
                </Link>
            </div>
        </div>
    );
}