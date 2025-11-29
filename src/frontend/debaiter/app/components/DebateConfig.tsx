// Page Author: Moiz
// Description: Component for configuring a new debate before starting.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // We'll use this to change pages

// Define the types for our selections
type OpponentType = 'human' | 'ai' | null;
type RoleType = 'affirmative' | 'negative' | null;
type TopicType = string | null;

// Mock list of topics
const topics = [
    'Space exploration is a worthwhile investment.',
    'Social media has a net negative impact on society.',
    'Artificial intelligence will do more harm than good.',
    'Climate change is the most pressing global issue.',
    'Universal basic income should be implemented.',
];

export default function DebateConfig() {
    const router = useRouter();
    const [opponent, setOpponent] = useState<OpponentType>(null);
    const [role, setRole] = useState<RoleType>(null);
    const [topic, setTopic] = useState<TopicType>(null);

    const startDebate = () => {
        if (!opponent || !role || !topic) {
            // In a real app, you'd show a nicer error message
            alert('Please make all selections before starting.');
            return;
        }

        const newDebateId = crypto.randomUUID();
        const queryParams = new URLSearchParams({
        topic: topic,
        role: role,
        opponent: opponent,
        });
        const href = `/debate/${newDebateId}?${queryParams.toString()}`;

        router.push(href);

    };

    // Helper component for styled buttons
    const ConfigButton = ({
        onClick,
        isSelected,
        children,
    }: {
        onClick: () => void;
        isSelected: boolean;
        children: React.ReactNode;
    }) => (
        <button
            onClick={onClick}
            className={`
        w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors
        ${isSelected
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }
      `}
        >
            {children}
        </button>
    );

    return (
        <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-8 shadow-lg">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900">
                Create a New Debate
            </h1>
            <p className="mb-6 text-base text-zinc-600">
                Choose your configuration to get started.
            </p>

            <div className="flex flex-col gap-6">
                {/* --- 1. Choose Opponent --- */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-zinc-500">
                        PLAY AGAINST
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {/* <ConfigButton
                            onClick={() => setOpponent('human')}
                            isSelected={opponent === 'human'}
                        >
                            Human
                        </ConfigButton> */}
                        <ConfigButton
                            onClick={() => setOpponent('ai')}
                            isSelected={opponent === 'ai'}
                        >
                            AI
                        </ConfigButton>
                    </div>
                </div>

                {/* --- 2. Choose Role --- */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-zinc-500">YOUR ROLE</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <ConfigButton
                            onClick={() => setRole('affirmative')}
                            isSelected={role === 'affirmative'}
                        >
                            Affirmative Speaker
                        </ConfigButton>
                        <ConfigButton
                            onClick={() => setRole('negative')}
                            isSelected={role === 'negative'}
                        >
                            Negative Speaker
                        </ConfigButton>
                    </div>
                </div>

                {/* --- 3. Choose Topic --- */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-zinc-500">TOPIC</h2>
                    <div className="flex flex-col gap-2">
                        {topics.map((topicText) => (
                            <ConfigButton
                                key={topicText}
                                onClick={() => setTopic(topicText)}
                                isSelected={topic === topicText}
                            >
                                {topicText}
                            </ConfigButton>
                        ))}
                    </div>
                </div>

                {/* --- Start Button --- */}
                <button
                    onClick={startDebate}
                    disabled={!opponent || !role || !topic}
                    className="mt-4 w-full rounded-lg bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                    Start Debate
                </button>
            </div>
        </div>
    );
}