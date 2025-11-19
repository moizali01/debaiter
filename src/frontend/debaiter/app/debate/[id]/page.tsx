// Page Author: Moiz
// Description: Debate page component that handles the debate interface and logic.

'use client';

import { use, useState, useEffect, useRef } from 'react'; // Import useEffect
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react';
import LinkModal from '../../components/LinkModal'

// Speech to text interface
interface IWindow extends Window {
	webkitSpeechRecognition: any;
	SpeechRecognition: any;
}

// This is a type for our chat messages
type Message = {
	id: number | string;
	text: string;
};

const MAX_TURNS = 8;

// // Hardcode session for local testing
// const session = {
// 	user: {
// 		email: "dcaglar2@uic.edu",
// 		name: "Deniz Caglar"
// 	}
// }

type DebateParams = {
	topic: string,
	role: 'affirmative' | 'negative',
	opponent: 'human' | 'ai'
}

export default function DebatePage({ params }: { params: Promise<{ id: string }> }) {

	// Get current session
	const { data: session } = useSession();

	const searchParams = useSearchParams();
	const topic = searchParams.get('topic') || 'Random topic here';
	const userRole = searchParams.get('role') || 'affirmative';
	const opponentType = searchParams.get('opponent') || 'ai';

	const debateParams = {
		topic: topic,
		role: userRole,
		opponent: opponentType
	} as DebateParams

	// see if user role is affirmative or negative, set opponent role accordingly
	const opponentRole = userRole === 'affirmative' ? 'negative' : 'affirmative';
	const opponentTypeStr = opponentType === 'human' ? 'Human' : 'AI';

	// Socket parameters
	const { id } = use(params);
	const debateId = id;
	// console.log("Debate ID:", debateId);
	const socketRef = useRef<Socket | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
	const [isTyping, setIsTyping] = useState(false);

	const [userInput, setUserInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	// --- New state for timer ---
	const [timer, setTimer] = useState<number | null>(null);
	const [isTurnActive, setIsTurnActive] = useState(userRole === 'affirmative');

	const [turnCount, setTurnCount] = useState(0);
	const [isDebateFinished, setIsDebateFinished] = useState(false);

	// Mock data to show the layout.
	const [userMessages, setUserMessages] = useState<Message[]>([]);
	const [opponentMessages, setOpponentMessages] = useState<Message[]>([]);

	// Link Modal
	const [modalState, setModalState] = useState<boolean>(false);

	// Opponent link
	const opponentQueryParams = new URLSearchParams({
		topic: debateParams.topic,
		role: opponentRole,
		opponent: 'human'
	} as DebateParams);

	const opponentLink = `${process.env.NEXT_PUBLIC_FRONTEND_HOSTNAME}/debate/${debateId}?${opponentQueryParams.toString()}`;


	// Helper func to format roles
	const formatRole = (role: string | null) => {
		// console.log("Formatting role:", role);
		if (role === 'affirmative') return 'Affirmative Speaker';
		if (role === 'negative') return 'Negative Speaker';
		return 'Participant';
	};

	// -- Speech to text setup --
	const [isListening, setIsListening] = useState(false);
	const recognitionRef = useRef<any>(null);

	const toggleListening = () => {
		if (isListening) {
			recognitionRef.current?.stop();
			setIsListening(false);
			return;
		}

		const { webkitSpeechRecognition } = window as unknown as IWindow;

		if (!webkitSpeechRecognition) {
			alert("Your browser does not support Speech to Text. Please use Google Chrome.");
			return;
		}

		const recognition = new webkitSpeechRecognition();
		recognition.continuous = true;
		recognition.interimResults = true; // Show results while speaking
		recognition.lang = 'en-US';

		recognition.onstart = () => {
			setIsListening(true);
		};

		recognition.onresult = (event: any) => {
			let finalTranscript = '';

			// Loop through results to build the transcript
			for (let i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					finalTranscript += event.results[i][0].transcript;
				} else {
					finalTranscript += event.results[i][0].transcript;
				}
			}

			// Update the userInput state
			// Note: This replaces current input. If you want to append, use setUserInput(prev => prev + finalTranscript)
			console.log("Speech to Text Interim Transcript:", finalTranscript);
			setUserInput(finalTranscript);
		};

		recognition.onend = () => {
			setIsListening(false);
		};

		recognition.onerror = (event: any) => {
			console.error("Speech recognition error", event.error);
			setIsListening(false);
		};

		recognitionRef.current = recognition;
		recognition.start();
	};

	// -- JUDGE LOGIC --
	const concludeDebate = async () => {
		setIsDebateFinished(true);
		setIsTurnActive(false);
		setTimer(null);
		console.log("Debate finished. Sending transcript to Judge API...");

		// Combine messages for transcript
		const fullTranscript = [...userMessages, ...opponentMessages].sort((a, b) =>
			0
		);

		// await fetch('http://localhost:8080/judge', { body: JSON.stringify(fullTranscript) ... })
	};

	// -- Function to communicate with AI --
	const fetchAIResponse = async (promptMessage: string) => {
		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_HOSTNAME}/promptAI`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: promptMessage, topic: topic, role: opponentRole }),
			});

			if (!response.ok) throw new Error('API Error');
			const data = await response.json();

			const aiReplyMessage: Message = {
				id: crypto.randomUUID(),
				text: data.reply,
			};
			setOpponentMessages((prev) => [...prev, aiReplyMessage]);

			// Increment turn count for AI's move
			setTurnCount(prev => {
				const newCount = prev + 1;
				if (newCount >= MAX_TURNS) {
					concludeDebate();
					return newCount;
				}
				// If not finished, it's User's turn now
				setIsTurnActive(true);
				setTimer(60);
				return newCount;
			});

		} catch (error) {
			console.error(error);
			setIsTurnActive(true); // Give control back to user on error
		} finally {
			setIsLoading(false);
		}
	};



	// TODO: Add to logic to give AI the start if it's affirmative and user is negative
	// Ref to prevent double-firing in React Strict Mode
	const hasStartedRef = useRef(false);
	useEffect(() => {
		const isAI = opponentType?.toLowerCase() === 'ai';
		const isUserNegative = userRole === 'negative';

		// must be AI opponent, user must be negativee, Start of game, Not already fired
		if (isAI && isUserNegative && turnCount === 0 && !hasStartedRef.current) {

			console.log("Triggering AI opening argument...");
			hasStartedRef.current = true; // Mark as started so it doesn't fire twice
			setIsLoading(true);

			fetchAIResponse(`You are the affirmative speaker. Please provide your opening argument for the topic: ${topic}`);
		}
	}, [opponentType, userRole, turnCount, topic]);


	// If opponent type is human, setup a socket server
	if (opponentType === "human") {

		// initialize the socket connection
		useEffect(() => {
			if (!session?.user) return;

			if (socketRef.current === null || socketRef.current === undefined ) {
				// Only setup a connection if one doesn't exist already
				socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_HOSTNAME, {
					transports: ['websocket', 'polling']
				});

				socketRef.current.on('connect', () => {
					if (connectionStatus === "disconnected" || connectionStatus === "connecting") {
						// Only send a join debate message if this is your first time connecting
						// or if you're reconnecting
						console.log('Connected to server');
						setConnectionStatus('connected');

						// event for joining the room based on debateId
						socketRef.current?.emit('join-debate', {
							debateId,
							userId: session.user?.email,
							userName: session.user?.name,
							role: userRole,
							opponentType
						});
					}

				});

				socketRef.current.on('disconnect', () => {
					console.log('Disconnected from server');
					setConnectionStatus('disconnected');
				});

				// event receive from server for debate state
				socketRef.current.on('debate-state', ({ currentTurn, timerActive, participantCount }) => {
					if (participantCount === 2) {
						// If a debate has already started
						const isMyTurn = currentTurn === userRole;
						setIsTurnActive(isMyTurn);
						if (isMyTurn && timerActive) {
							//if it's user's turn start timer
							setTimer(60);
						}
					} else {
						// If a debate hasn't started, show user the opponent link modal
						// so they can share the link with someone
						setModalState(true);
					}
				});

				// if both user connected to room then receives even from server (human vs Human)
				socketRef.current.on('debate-ready', ({ message, currentTurn }) => {
					// We're good to go! Deactivate the opponent link modal
					setModalState(false);

					console.log(message);
					const isMyTurn = currentTurn === userRole;
					setIsTurnActive(isMyTurn);
					if (isMyTurn) {
						setTimer(60);
					}
				});

				// if server sends a new message from opponent
				socketRef.current.on('new-message', ({ from, text, timestamp }) => {
					if (from !== userRole) {
						// If this is a message from your opponent, mark it as so
						const newMessage: Message = {
							id: `${from}-${timestamp}`,
							text: text,
						};
						setOpponentMessages(prev => [...prev, newMessage]);
						setIsLoading(false);
					}
				});

				// handle turn changes event from server
				socketRef.current.on('turn-changed', ({ currentTurn, startTimer, reason }) => {
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
				socketRef.current.on('opponent-typing', () => {
					setIsTyping(true);
				});

				//while opponent stopped typing for 2 sec
				socketRef.current.on('opponent-stop-typing', () => {
					setIsTyping(false);
				});

				// when user joins
				socketRef.current.on('participant-joined', ({ userName, role }) => {
					console.log(`${userName} joined as ${role}`);
				});
				// when user leaves
				socketRef.current.on('participant-left', ({ userName, role }) => {
					console.log(`${userName} (${role}) left the debate`);
				});

				socketRef.current.on('error', ({ message }) => {
					console.error('Socket error:', message);
					alert(message);
				});

			}


			// Cleanup on unmount
			return () => {
				if (socketRef.current?.connected)
					socketRef.current.disconnect();
			};
		}, [session, debateId, userRole, opponentType]);

	}

	// -- Timer Logic --
	useEffect(() => {
		if (timer === null) return;

		// Timer finished
		if (timer === 0) {
			console.log("Time's up!");
			setIsTurnActive(false);
			setTimer(null);

			// TODO : If there is text in the textbox or the user is currently
			// recording, stop doing both of these things and submit what you have
			//
			// Or keep doing what we're doing right now which is to submit nothing
			// and just switch turns to the opponent
			const switchedTurn = userRole === 'affirmative' ? 'negative' : 'affirmative'

			socketRef.current?.emit('turn-changed',{
				currentTurn : switchedTurn,
				startTimer : true,
				reason : 'timer-expired'

			})

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
		setIsListening(false);

		try {
			// Send message to either socket server
			if (opponentType === "human") {

				socketRef.current?.emit('stop-typing', { debateId });

				// send message to server
				socketRef.current?.emit('send-message', {
					debateId,
					message: currentInput,
					role: userRole,
					opponentType
				});

			} else {
				// AI opponent
				await fetchAIResponse(currentInput);
			}
		} catch (error) {
			console.error('Failed to get response from LLM or other user:', error);
			const errorMessage: Message = {
				id: crypto.randomUUID(),
				text: 'Error getting response from LLM or other user. Check console.',
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

					<LinkModal isOpen={modalState} opponentLink={opponentLink} />

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
							<div className="relative flex-grow">
								<textarea
									value={userInput}
									onChange={(e) => setUserInput(e.target.value)}
									placeholder={
										isTurnActive
											? (isListening ? 'Listening...' : 'Enter your argument...')
											: isLoading
												? 'Opponent is thinking...'
												: "Time's up! Waiting for opponent."
									}
									rows={3}
									className={`w-full resize-none rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white
										${isListening ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-300 dark:border-zinc-700'}
									`}
									disabled={isLoading || !isTurnActive}
								/>

								{/* Mic Button - Positioned absolute inside or flex outside. Here it is outside for clarity */}
							</div>

							{/* Buttons Container */}
							<div className="flex flex-col gap-2">
								<button
									type="button" // Important: prevent form submission
									onClick={toggleListening}
									disabled={isLoading || !isTurnActive}
									className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors 
										${isListening
											? 'animate-pulse bg-red-600 text-white hover:bg-red-700'
											: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300'
										}`}
									title="Speech to Text"
								>
									<MicIcon isListening={isListening} />
								</button>

								<button
									type="submit"
									className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
									disabled={isLoading || !isTurnActive}
								>
									{isLoading ? (
										<div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
									) : (
										<SendIcon />
									)}
								</button>
							</div>
						</div>
					</form>
				</section>

				{/* --- 2. Opponent Panel (Right) --- */}
				<section className="flex w-full flex-col lg:w-1/2">
					{/* Panel Header */}
					<div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
						<h2 className="font-semibold text-zinc-900 dark:text-white">
							Opponent ({opponentTypeStr})
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

function MicIcon({ isListening }: { isListening: boolean }) {
	if (isListening) {
		// Stop Icon (Square)
		return (
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
				<path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
			</svg>
		);
	}
	// Mic Icon
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
			<path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
			<path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
		</svg>
	);
}

