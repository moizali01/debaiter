// Page Author: Moiz
// Description: Debate page component that handles the debate interface and logic.

'use client';

import { useState, useEffect } from 'react'; // Import useEffect
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'path';

// This is a type for our chat messages
type Message = {
    id: number | string;
    text: string;
};

export default function DebatePage({ params }: { params: { id: string } }) {

    const searchParams = useSearchParams();
    const topic = searchParams.get('topic') || 'No topic selected';
    const userRole = searchParams.get('role');
    const opponentType = searchParams.get('opponent');

    // see if user role is affirmative or negative, set opponent role accordingly
    const opponentRole = userRole === 'affirmative' ? 'negative' : 'affirmative';


    const formatRole = (role: string | null) => {
        console.log("Formatting role:", role);
        if (role === 'affirmative') return 'Affirmative Speaker';
        if (role === 'negative') return 'Negative Speaker';
        return 'Participant';
    };


    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- New state for timer ---
    const [timer, setTimer] = useState<number | null>(null);
    const [isTurnActive, setIsTurnActive] = useState(true);

    // Mock data to show the layout.
    const [userMessages, setUserMessages] = useState<Message[]>([]);
    const [opponentMessages, setOpponentMessages] = useState<Message[]>([]);

    // useEffect for the timer 
    useEffect(() => {
        if (timer === null) return;

        // Timer finished
        if (timer === 0) {
            setIsTurnActive(false);
            setTimer(null);
            console.log("Time's up!");


            return;
        }

        // Countdown logic
        const intervalId = setInterval(() => {
            setTimer((prev) => (prev ? prev - 1 : null));
        }, 1000);

        // Cleanup interval on component unmount or timer change
        return () => clearInterval(intervalId);
    }, [timer]); // Re-run whenever the timer value changes

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !isTurnActive) return;

        const currentInput = userInput;

        // Add new user message to the UI
        const newUserMessage: Message = {
            id: crypto.randomUUID(),
            text: currentInput,
        };
        setUserMessages((prev) => [...prev, newUserMessage]);

        // Clear input and set loading state
        setUserInput('');
        setIsLoading(true);
        setIsTurnActive(false);
        setTimer(null);

        // send message to backend to get AI response
        try {
            const response = await fetch('http://localhost:8080/MessageToAI', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: currentInput }),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            // 4. Get the AI's reply from the backend
            const data = await response.json();

            const aiReplyMessage: Message = {
                id: crypto.randomUUID(),
                text: data.reply,
            };

            setOpponentMessages((prev) => [...prev, aiReplyMessage]);

            // --- START TIMER ---
            // user's turn: start the 60s timer
            setIsTurnActive(true);
            setTimer(60);
        } catch (error) {
            console.error('Failed to get AI response:', error);
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                text: 'Error getting response from AI. Check console.',
            };
            setOpponentMessages((prev) => [...prev, errorMessage]);

            setIsTurnActive(true);
        } finally {

            setIsLoading(false);
        }
    };

    const ChatBubble = ({
        message,
        from,
    }: {
        message: Message;
        from: 'user' | 'opponent';
    }) => (
        <div
            className={`max-w-xs rounded-lg px-4 py-2 ${from === 'user'
                    ? 'self-end rounded-br-none bg-blue-600 text-white'
                    : 'self-start rounded-bl-none bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                }`}
        >
            {message.text}
        </div>
    );

    // --- Helper to format timer ---
    const formatTime = (seconds: number | null) => {
        if (seconds === null) return '...';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
            // We wrap the main content in another div to add the topic header
        <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* --- NEW: Topic Header --- */}
        <header className="w-full border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
            <h1 className="truncate text-center text-base font-semibold text-zinc-900 dark:text-white">
            <span className="text-zinc-500">Topic: </span>
            {topic}
            </h1>
        </header>

        <main className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
            {/* --- 1. User Panel (Left) --- */}
            <section className="flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 lg:w-1/2">
                {/* Panel Header */}
                <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                    <h2 className="font-semibold text-zinc-900 dark:text-white">You</h2>
                    <p className="text-sm text-zinc-500">{formatRole(userRole)}</p>
                </div>

                {/* Message List */}
                <div className="flex-grow space-y-4 overflow-y-auto p-6">
                    {userMessages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} from="user" />
                    ))}
                </div>

                {/* Input Box */}
                <form
                    onSubmit={handleSubmit}
                    className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black"
                >
                    {/* --- TIMER DISPLAY --- */}
                    <div className="mb-2 flex justify-between text-sm">
                        <span
                            className={`font-medium ${!isTurnActive && timer === null
                                    ? 'text-zinc-500'
                                    : 'text-zinc-900 dark:text-white'
                                }`}
                        >
                            {isTurnActive ? 'Your Turn' : 'Waiting for Opponent...'}
                        </span>
                        <span
                            className={`font-mono font-semibold ${timer !== null && timer <= 10
                                    ? 'text-red-600'
                                    : 'text-zinc-700 dark:text-zinc-300'
                                }`}
                        >
                            {timer !== null && `Time: ${formatTime(timer)}`}
                        </span>
                    </div>

                    <div className="flex items-start gap-3">
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder={
                                isTurnActive
                                    ? 'Enter your argument...'
                                    : isLoading
                                        ? 'Opponent is thinking...'
                                        : "Time's up! Waiting for opponent."
                            }
                            rows={3}
                            className="flex-grow resize-none rounded-lg border border-zinc-300 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                            disabled={isLoading || !isTurnActive} // Disable input
                        />
                        <button
                            type="submit"
                            className="h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                            disabled={isLoading || !isTurnActive} // Disable button
                        >
                            {isLoading ? (
                                // Simple loading spinner
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <SendIcon />
                            )}
                        </button>
                    </div>
                </form>
            </section>

            {/* --- 2. Opponent Panel (Right) --- */}
            <section className="flex w-full flex-col lg:w-1/2">
                {/* Panel Header */}
                <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                    <h2 className="font-semibold text-zinc-900 dark:text-white">
                        Opponent (AI)
                    </h2>
                    <p className="text-sm text-zinc-500">{formatRole(opponentRole)}</p>
                </div>

                {/* Message List */}
                <div className="flex-grow space-y-4 overflow-y-auto p-6">
                    {opponentMessages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} from="opponent" />
                    ))}
                    {isLoading && (
                        <div className="self-start rounded-lg rounded-bl-none bg-zinc-200 px-4 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            <span className="animate-pulse">Opponent is typing...</span>
                        </div>
                    )}
                </div>
            </section>
        </main>
        </div>
    );
}

// --- Send Icon SVG ---
function SendIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
        >
            <path d="M3.105 3.106a.75.75 0 01.884-.06l14.25 8.25a.75.75 0 010 1.308l-14.25 8.25a.75.75 0 01-.884-.06.75.75 0 01-.06-.884l1.9-5.25H9.75a.75.75 0 000-1.5H4.945L3.045 3.99a.75.75 0 01.06-.884z" />
        </svg>
    );
}