// Page Author: Moiz (updated with Socket.IO support)
// Description: Debate page component that handles the debate interface and logic.

'use client';

import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

// This is a type for our chat messages
type Message = {
  id: string;
  text: string;
};

// Payload type for messages coming from the Socket.IO server
type NewArgumentPayload = {
  debateId: string;
  fromRole: string;
  text: string;
};

type JoinDebatePayload = {
  debateId: string;
  role: string;
  name: string;
};

type DebatePageProps = {
  params: { id: string };
};

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

export default function DebatePage({ params }: DebatePageProps) {
  const searchParams = useSearchParams();
  const debateId = params.id;

  const topic = searchParams.get('topic') ?? 'Untitled Topic';
  const userRole = searchParams.get('role') ?? 'affirmative';
  const opponentLabel = searchParams.get('opponent') ?? 'Opponent';

  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [opponentMessages, setOpponentMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Timer & turn logic
  const [timer, setTimer] = useState<number | null>(60);
  const [isTurnActive, setIsTurnActive] = useState(true);

  // Socket.IO reference
  const socketRef = useRef<Socket | null>(null);

  // --- Setup Socket.IO connection ---
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Join debate room when connected
    const joinPayload: JoinDebatePayload = {
      debateId,
      role: userRole,
      name: 'You',
    };
    socket.emit('join-debate', joinPayload);

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on(
      'new-argument',
      ({ debateId: roomId, fromRole, text }: NewArgumentPayload) => {
        if (roomId !== debateId) return;
        const msg: Message = { id: crypto.randomUUID(), text };

        // If the message was sent by the same role as this user,
        // treat it as a "user" message; otherwise as "opponent".
        if (fromRole === userRole) {
          setUserMessages((prev) => [...prev, msg]);
        } else {
          setOpponentMessages((prev) => [...prev, msg]);
        }
      }
    );

    socket.on('player-joined', (payload: JoinDebatePayload) => {
      console.log('Player joined:', payload);
    });

    socket.on('player-left', (payload: JoinDebatePayload) => {
      console.log('Player left:', payload);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [debateId, userRole]);

  // --- Timer effect (behaviour preserved) ---
  useEffect(() => {
    if (timer === null) return;

    // If timer finished
    if (timer === 0) {
      setIsTurnActive(false);
      setTimer(null);
      console.log("Time's up!");
      return;
    }

    // Countdown logic
    const intervalId = setInterval(() => {
      setTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, 1000);

    // Cleanup interval
    return () => clearInterval(intervalId);
  }, [timer]);

  // --- Form submit handler (behaviour preserved) ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !isTurnActive) return;

    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    // Locally add the new user message (for instant feedback)
    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      text: currentInput,
    };
    setUserMessages((prev) => [...prev, newUserMessage]);

    // Broadcast via Socket.IO to other players
    socketRef.current?.emit('submit-argument', {
      debateId,
      role: userRole,
      text: currentInput,
    });

    try {
      // Keep existing backend behaviour: call /MessageToAI
      const response = await fetch('http://localhost:8080/MessageToAI', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
      });

      if (!response.ok) {
        console.error('Error from /MessageToAI:', response.statusText);
      } else {
        const data = (await response.json()) as { reply?: string };
        const aiText = data.reply ?? '(No response received)';

        const newOpponentMessage: Message = {
          id: crypto.randomUUID(),
          text: aiText,
        };

        setOpponentMessages((prev) => [...prev, newOpponentMessage]);
      }
    } catch (err) {
      console.error('Failed to contact AI backend:', err);
    } finally {
      // Restart the turn timer exactly like before
      setTimer(60);
      setIsTurnActive(true);
      setIsLoading(false);
    }
  };

  const isInputDisabled = !isTurnActive || isLoading;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Debate Room</h1>
          <p className="text-sm text-slate-400">
            Topic: <span className="font-medium text-slate-200">{topic}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div>
              You are:{' '}
              <span className="font-medium capitalize">{userRole}</span>
            </div>
            <div className="text-slate-400 text-xs">
              Opponent: <span className="font-medium">{opponentLabel}</span>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono">
            {timer !== null ? (
              <>
                Time left:{' '}
                <span className="font-semibold">
                  {timer.toString().padStart(2, '0')}s
                </span>
              </>
            ) : (
              <span className="text-red-400 font-semibold">Time&apos;s up</span>
            )}
          </div>
        </div>
      </header>

      <section className="flex-1 px-4 py-4 max-w-5xl mx-auto w-full flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {/* Your arguments */}
          <div className="border border-slate-800 rounded-xl flex flex-col overflow-hidden bg-slate-900/60">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your Arguments</h2>
              <span className="text-xs text-emerald-400 capitalize">
                {userRole}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {userMessages.length === 0 && (
                <p className="text-xs text-slate-500">
                  You haven&apos;t said anything yet. Start the debate!
                </p>
              )}
              {userMessages.map((message) => (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-emerald-600 px-3 py-2 text-sm shadow">
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opponent arguments */}
          <div className="border border-slate-800 rounded-xl flex flex-col overflow-hidden bg-slate-900/40">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {opponentLabel}&apos;s Arguments
              </h2>
              <span className="text-xs text-sky-400 capitalize">opponent</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {opponentMessages.length === 0 && (
                <p className="text-xs text-slate-500">
                  Waiting for your opponent to respond…
                </p>
              )}
              {opponentMessages.map((message) => (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-slate-800 px-3 py-2 text-sm shadow">
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="mt-2 border border-slate-800 rounded-xl bg-slate-900/60 px-3 py-2 flex items-center gap-2"
        >
          <textarea
            className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-slate-100 placeholder:text-slate-500 px-2 py-1"
            rows={2}
            placeholder={
              isInputDisabled
                ? isLoading
                  ? 'Waiting for opponent...'
                  : "It's not your turn yet."
                : 'Type your argument here…'
            }
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isInputDisabled}
          />

          <button
            type="submit"
            disabled={isInputDisabled || !userInput.trim()}
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-1">
          Turn status:{' '}
          {isTurnActive ? (
            <span className="text-emerald-400 font-medium">Your turn</span>
          ) : (
            <span className="text-slate-400">
              Waiting for the next round to start.
            </span>
          )}
        </p>
      </section>
    </main>
  );
}

// --- Send Icon SVG (simple) ---
function SendIcon() {
  return (
    <span className="inline-block text-base leading-none rotate-45">
      ➤
    </span>
  );
}
