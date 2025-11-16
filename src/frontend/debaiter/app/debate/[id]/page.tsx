// Page Author: Moiz
// Description: Debate page component with Socket.IO integration

'use client';

import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';


//type for meessage
type Message = {
    id: number | string;
    text: string;
    from: 'user' | 'opponent';
    timestamp: number;
};

export default function DebatePage({ params }: { params: { id: string } }) {
    const { data: session } = useSession();
    //get the properties topic, role, opponent from the url
    const searchParams = useSearchParams();
    const topic = searchParams.get('topic') || 'No topic selected';
    const userRole = searchParams.get('role');
    const opponentType = searchParams.get('opponent');

    //set opponent role
    const opponentRole = userRole === 'affirmative' ? 'negative' : 'affirmative';
    //debateId used as room id in socket.io
    const debateId = params.id;

    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState<number | null>(null);
    const [isTurnActive, setIsTurnActive] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

    const socketRef = useRef<Socket | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // initialize the socket connection
    useEffect(() => {
        if (!session?.user) return;

        const socket = io('http://localhost:8080', {
            transports: ['websocket', 'polling']
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to server');
            setConnectionStatus('connected');

            // event for joining the room based on debateId
            socket.emit('join-debate', {
                debateId,
                userId: session.user.email,
                userName: session.user.name,
                role: userRole,
                opponentType
            });
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setConnectionStatus('disconnected');
        });

        // event receive from server for debate state
        socket.on('debate-state', ({ currentTurn, timerActive }) => {
            const isMyTurn = currentTurn === userRole;
            setIsTurnActive(isMyTurn);
            if (isMyTurn && timerActive) {
              //if it's user's turn start timer
                setTimer(60);  
            }
        });

        // if both user connected to room then receives even from server (human vs Human)
        socket.on('debate-ready', ({ message, currentTurn }) => {
            console.log(message);
            const isMyTurn = currentTurn === userRole;
            setIsTurnActive(isMyTurn);
            if (isMyTurn) {
                setTimer(60);
            }
        });

        // if server sends a new message from opponent
        socket.on('new-message', ({ from, text, timestamp }) => {
            const newMessage: Message = {
                id: `${from}-${timestamp}`,
                text,
                from: from === userRole ? 'user' : 'opponent',
                timestamp
            };
            setMessages(prev => [...prev, newMessage]);
            setIsLoading(false);
        });

        // handle turn changes event from server
        socket.on('turn-changed', ({ currentTurn, startTimer, reason }) => {
            const isMyTurn = currentTurn === userRole;
            setIsTurnActive(isMyTurn);
            
            if (isMyTurn && startTimer) {
                setTimer(60);
            } else {
                setTimer(null);
            }

            if (reason === 'timer-expired') {
                console.log('Turn switched due to timer expiration');
            }
        });

        // while opponent is typing
        socket.on('opponent-typing', () => {
            setIsTyping(true);
        });
        
        //while opponent stopped typing for 2 sec
        socket.on('opponent-stop-typing', () => {
            setIsTyping(false);
        });

        // when user joins
        socket.on('participant-joined', ({ userName, role }) => {
            console.log(`${userName} joined as ${role}`);
        });
        // when user leaves
        socket.on('participant-left', ({ userName, role }) => {
            console.log(`${userName} (${role}) left the debate`);
        });

        socket.on('error', ({ message }) => {
            console.error('Socket error:', message);
            alert(message);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [session, debateId, userRole, opponentType]);

    // Timer countdown effect
    useEffect(() => {
        if (timer === null) return;

        if (timer === 0) {
            setIsTurnActive(false);
            setTimer(null);
            console.log("Time's up!");
            
            // send timer-expired event to server
            socketRef.current?.emit('timer-expired', {
                debateId,
                role: userRole
            });
            return;
        }

        const intervalId = setInterval(() => {
            setTimer((prev) => (prev ? prev - 1 : null));
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timer, debateId, userRole]);

    // typing or stopped typing handler
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);

        // typing event
        if (socketRef.current && !isLoading) {
            socketRef.current.emit('typing', { debateId, role: userRole });

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // stopped typing event after 2 sec
            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current?.emit('stop-typing', { debateId });
            }, 2000);
        }
    };

    //on submit event handler
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !isTurnActive || !socketRef.current) return;

        const currentInput = userInput.trim();
        setUserInput('');
        setIsLoading(true);
        setIsTurnActive(false);
        setTimer(null);


        socketRef.current.emit('stop-typing', { debateId });

        // send message to server
        socketRef.current.emit('send-message', {
            debateId,
            message: currentInput,
            role: userRole,
            opponentType
        });
    };

    const formatRole = (role: string | null) => {
        if (role === 'affirmative') return 'Affirmative Speaker';
        if (role === 'negative') return 'Negative Speaker';
        return 'Participant';
    };

    const formatTime = (seconds: number | null) => {
        if (seconds === null) return '...';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const ChatBubble = ({ message }: { message: Message }) => (
        <div
            className={`max-w-xs rounded-lg px-4 py-2 ${
                message.from === 'user'
                    ? 'self-end rounded-br-none bg-blue-600 text-white'
                    : 'self-start rounded-bl-none bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white'
            }`}
        >
            {message.text}
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col">
            {/* Topic Header */}
            <header className="w-full border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
                <div className="flex items-center justify-between">
                    <h1 className="truncate text-center text-base font-semibold text-zinc-900 dark:text-white">
                        <span className="text-zinc-500">Topic: </span>
                        {topic}
                    </h1>
                    <div className={`ml-4 flex items-center gap-2 text-xs ${
                        connectionStatus === 'connected' ? 'text-green-600' : 
                        connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                        <div className={`h-2 w-2 rounded-full ${
                            connectionStatus === 'connected' ? 'bg-green-600' : 
                            connectionStatus === 'connecting' ? 'bg-yellow-600 animate-pulse' : 'bg-red-600'
                        }`} />
                        {connectionStatus}
                    </div>
                </div>
            </header>

            <main className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
                {/* User Panel (Left) */}
                <section className="flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 lg:w-1/2">
                    <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                        <h2 className="font-semibold text-zinc-900 dark:text-white">You</h2>
                        <p className="text-sm text-zinc-500">{formatRole(userRole)}</p>
                    </div>

                    {/* Message List */}
                    <div className="flex-grow space-y-4 overflow-y-auto p-6">
                        {messages
                            .filter(msg => msg.from === 'user')
                            .map(msg => (
                                <ChatBubble key={msg.id} message={msg} />
                            ))}
                    </div>

                    {/* Input Box */}
                    <form
                        onSubmit={handleSubmit}
                        className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black"
                    >
                        <div className="mb-2 flex justify-between text-sm">
                            <span
                                className={`font-medium ${
                                    !isTurnActive && timer === null
                                        ? 'text-zinc-500'
                                        : 'text-zinc-900 dark:text-white'
                                }`}
                            >
                                {isTurnActive ? 'Your Turn' : 'Waiting for Opponent...'}
                            </span>
                            <span
                                className={`font-mono font-semibold ${
                                    timer !== null && timer <= 10
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
                                onChange={handleInputChange}
                                placeholder={
                                    isTurnActive
                                        ? 'Enter your argument...'
                                        : isLoading
                                        ? 'Opponent is thinking...'
                                        : "Time's up! Waiting for opponent."
                                }
                                rows={3}
                                className="flex-grow resize-none rounded-lg border border-zinc-300 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                disabled={isLoading || !isTurnActive}
                            />
                            <button
                                type="submit"
                                className="h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                                disabled={isLoading || !isTurnActive}
                            >
                                {isLoading ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <SendIcon />
                                )}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Opponent Panel (Right) */}
                <section className="flex w-full flex-col lg:w-1/2">
                    <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                        <h2 className="font-semibold text-zinc-900 dark:text-white">
                            Opponent ({opponentType === 'ai' ? 'AI' : 'Human'})
                        </h2>
                        <p className="text-sm text-zinc-500">{formatRole(opponentRole)}</p>
                    </div>

                    {/* Message List */}
                    <div className="flex-grow space-y-4 overflow-y-auto p-6">
                        {messages
                            .filter(msg => msg.from === 'opponent')
                            .map(msg => (
                                <ChatBubble key={msg.id} message={msg} />
                            ))}
                        {(isLoading || isTyping) && (
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