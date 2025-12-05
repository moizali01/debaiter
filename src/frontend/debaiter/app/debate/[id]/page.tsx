// Page Author: Moiz
// Description: Debate page component that handles the debate interface and logic.

"use client";

import { use, useState, useEffect, useRef, useMemo } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import LinkModal from "../../components/LinkModal";
import { supabase } from "../../lib/supabase";
// Speech to text interface
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// This is a type for our chat messages
type Message = {
  id: number | string;
  text: string;
  timestamp: number;
};

const MAX_TURNS = 3;

// // Hardcode session for local testing
// const session = {
//     user: {
//         email: "dcaglar2@uic.edu",
//         name: "Deniz Caglar"
//     }
// }

type DebateParams = {
  topic: string;
  role: "affirmative" | "negative";
  opponent: "human" | "ai";
};

export default function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Get current session
  const { data: session } = useSession();

  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "Random topic here";
  const userRole = searchParams.get("role") || "affirmative";
  const opponentType = searchParams.get("opponent") || "ai";

  const debateParams = {
    topic: topic,
    role: userRole,
    opponent: opponentType,
  } as DebateParams;

  // see if user role is affirmative or negative, set opponent role accordingly
  const opponentRole = userRole === "affirmative" ? "negative" : "affirmative";
  const opponentTypeStr = opponentType === "human" ? "Human" : "AI";

  // Socket parameters
  const { id } = use(params);
  const debateId = id;

  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [isTyping, setIsTyping] = useState(false);

  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- New state for timer ---
  const [timer, setTimer] = useState<number | null>(null);
  const [isTurnActive, setIsTurnActive] = useState(userRole === "affirmative");

  const [turnCount, setTurnCount] = useState(0);
  const [isDebateFinished, setIsDebateFinished] = useState(false);

  // Mock data to show the layout.
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [opponentMessages, setOpponentMessages] = useState<Message[]>([]);

  // Link Modal
  const [modalState, setModalState] = useState<boolean>(false);
  const [participantCount, setParticipantCount] = useState<number>(0);

  const [debateResult, setDebateResult] = useState<{
    winner: string;
    reasoning: string;
  } | null>(null);

  // Opponent link
  const opponentQueryParams = new URLSearchParams({
    topic: debateParams.topic,
    role: opponentRole,
    opponent: "human",
  } as DebateParams);

  const opponentLink = `${
    process.env.NEXT_PUBLIC_FRONTEND_HOSTNAME
  }/debate/${debateId}?${opponentQueryParams.toString()}`;

  // --- MERGE MESSAGES FOR CHAT VIEW ---
  // We combine both arrays and sort them by timestamp to create a linear chat history
  const combinedMessages = useMemo(() => {
    const userMsgs = userMessages.map((m) => ({ ...m, from: "user" as const }));
    const oppMsgs = opponentMessages.map((m) => ({
      ...m,
      from: "opponent" as const,
    }));

    return [...userMsgs, ...oppMsgs].sort((a, b) => a.timestamp - b.timestamp);
  }, [userMessages, opponentMessages]);

  // Scroll to bottom helper
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const hasEmittedJudgeRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [combinedMessages, isTyping, isLoading]);

  // Helper func to format roles
  const formatRole = (role: string | null) => {
    if (role === "affirmative") return "Affirmative Speaker";
    if (role === "negative") return "Negative Speaker";
    return "Participant";
  };

  // -- Speech to text setup --
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const sttLastResultIndexRef = useRef<number>(0);

  const toggleListening = () => {
    // if listening stop
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const { webkitSpeechRecognition, SpeechRecognition } =
      window as unknown as IWindow;
    const SpeechRec = webkitSpeechRecognition || SpeechRecognition;

    if (!SpeechRec) {
      alert(
        "Your browser does not support Speech to Text. Please use Google Chrome."
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // Start fresh for this speech session
    sttLastResultIndexRef.current = 0;

    recognition.onresult = (event: any) => {
      let newFinalChunk = "";

      // Only process *new* results that we haven't seen yet
      for (
        let i = sttLastResultIndexRef.current;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinalChunk += result[0].transcript + " ";
        }
      }

      // Mark all results as processed
      sttLastResultIndexRef.current = event.results.length;

      // Append just the new final text to whatever is currently in the box
      if (newFinalChunk.trim().length > 0) {
        setUserInput((prev) => (prev + " " + newFinalChunk).trim());
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  // judge
  const concludeDebate = async () => {
    console.log("🏁 Concluding debate...");

    // Combine all messages into transcript
    const fullTranscript = [
      ...userMessages.map((msg) => ({
        role: userRole as string,
        text: msg.text,
        timestamp: msg.timestamp,
      })),
      ...opponentMessages.map((msg) => ({
        role: opponentRole as string,
        text: msg.text,
        timestamp: msg.timestamp,
      })),
    ].sort((a, b) => a.timestamp - b.timestamp);

    console.log("📝 Full transcript:", fullTranscript);

    try {
      // Call AI judge
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_HOSTNAME}/judgeAI`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic,
            transcript: fullTranscript,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Judge API failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("⚖️ Judge result:", result);

      // Determine if current user won
      const userWon = result.winner === userRole;

      // Save to Supabase if user is logged in
      if (session?.user?.email && session?.user?.name) {
        console.log("💾 Saving to Supabase...");

        const { data, error } = await supabase
          .from("debate_results")
          .insert({
            user_email: session.user.email,
            user_name: session.user.name,
            topic: topic,
            user_role: userRole as "affirmative" | "negative",
            opponent_type: opponentType as "human" | "ai",
            won: userWon,
            score: result.score,
            reasoning: result.reasoning,
            transcript: fullTranscript,
          })
          .select();

        if (error) {
          console.error("❌ Supabase save error:", error);
          // Don't throw - still show results even if save fails
        } else {
          console.log("✅ Saved to Supabase:", data);
        }
      } else {
        console.log("⚠️ User not logged in, skipping Supabase save");
      }

      setDebateResult(result);
      return result;
    } catch (error) {
      console.error("❌ Error concluding debate:", error);
      alert("Failed to get debate judgment. Please try again.");
      return null;
    }
  };

  // -- Function to communicate with AI --
  const fetchAIResponse = async (promptMessage: string) => {
    try {
      const fullTranscript = [...userMessages, ...opponentMessages].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_HOSTNAME}/promptAI`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: promptMessage,
            topic: topic,
            role: opponentRole,
            transcript: fullTranscript,
          }),
        }
      );

      if (!response.ok) throw new Error("API Error");
      const data = await response.json();

      const aiReplyMessage: Message = {
        id: crypto.randomUUID(),
        text: data.reply,
        timestamp: Date.now(),
      };
      setOpponentMessages((prev) => [...prev, aiReplyMessage]);

      setTurnCount((prev) => prev + 1);
      setIsTurnActive(true);
      setTimer(60);
    } catch (error) {
      console.error(error);
      setIsTurnActive(true); // Give control back to user on error
    } finally {
      setIsLoading(false);
    }
  };

  // Ref to prevent double-firing in React Strict Mode
  const hasStartedRef = useRef(false);
  useEffect(() => {
    const isAI = opponentType?.toLowerCase() === "ai";
    const isUserNegative = userRole === "negative";

    // must be AI opponent, user must be negativee, Start of game, Not already fired
    if (isAI && isUserNegative && turnCount === 0 && !hasStartedRef.current) {
      console.log("Triggering AI opening argument...");
      hasStartedRef.current = true; // Mark as started so it doesn't fire twice
      setIsLoading(true);

      fetchAIResponse(
        `You are the affirmative speaker. Please provide your opening argument for the topic: ${topic}`
      );
    }
  }, [opponentType, userRole, turnCount, topic]);

  useEffect(() => {
    if (turnCount < MAX_TURNS) return;
    if (hasEmittedJudgeRef.current) return; // already handled

    hasEmittedJudgeRef.current = true;

    // Turn debate off on THIS client
    setIsDebateFinished(true);
    setIsTurnActive(false);
    setTimer(null);
    setIsListening(false);

    if (opponentType === "ai") {
      // just judge locally
      void concludeDebate();
    } else if (opponentType === "human") {
      // only AFFIRMATIVE calls judge, then shares result
      if (userRole === "affirmative" && socketRef.current) {
        (async () => {
          const result = await concludeDebate();
          if (result) {
            socketRef.current?.emit("debate-result", {
              debateId,
              result,
            });
          }
        })();
      }
    }
  }, [turnCount, opponentType, userRole, debateId]);

  // If opponent type is human, setup a socket server
  useEffect(() => {
    // Only do socket stuff for human vs human
    if (opponentType !== "human") return;
    if (!session?.user) return; // user must be logged in

    if (!socketRef.current) {
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_HOSTNAME as string, {
        transports: ["websocket", "polling"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("✅ [client] Connected to socket server", {
          debateId,
          userRole,
        });

        setConnectionStatus("connected");

        socket.emit("join-debate", {
          debateId,
          userId: session.user?.email,
          userName: session.user?.name,
          role: userRole,
          opponentType, // should be "human" on BOTH tabs
          topic: topic,
        });
      });

      socket.on("disconnect", () => {
        console.log("⚠️ [client] Disconnected from socket server");
        setConnectionStatus("disconnected");
      });

      socket.on(
        "debate-state",
        ({ currentTurn, timerActive, participantCount }) => {
          console.log("📩 [client] debate-state", {
            currentTurn,
            timerActive,
            participantCount,
            userRole,
          });

          setParticipantCount(participantCount);

          if (participantCount >= 2) {
            // Two people in the room → hide modal for BOTH players
            setModalState(false);

            const isMyTurn = currentTurn === userRole;
            setIsTurnActive(isMyTurn);

            if (isMyTurn && timerActive) {
              setTimer(60);
            }
          } else {
            setModalState(true);
            setIsTurnActive(false);
            setTimer(null);
          }
        }
      );

      socket.on("debate-ready", ({ message, currentTurn }) => {
        console.log("📩 [client] debate-ready", {
          message,
          currentTurn,
          userRole,
        });

        setModalState(false);

        const isMyTurn = currentTurn === userRole;
        setIsTurnActive(isMyTurn);
        if (isMyTurn) {
          setTimer(60);
        }
      });

      socket.on("new-message", ({ from, text, timestamp }) => {
        console.log("📩 [client] new-message", {
          from,
          text,
          timestamp,
          userRole,
        });
        const id = `${from}-${timestamp}`;
        if (processedMessageIdsRef.current.has(id)) {
          console.log("⚠️ [client] Duplicate message ignored", { id });
          return;
        }
        processedMessageIdsRef.current.add(id);
        if (from !== userRole) {
          setOpponentMessages((prev) => [...prev, { id, text, timestamp }]);
          setIsLoading(false);
        }
        if (opponentType === "human" && from === "negative") {
          setTurnCount((prev) => prev + 1);
        }
      });

      socket.on("turn-changed", ({ currentTurn, startTimer, reason }) => {
        console.log("📩 [client] turn-changed", {
          currentTurn,
          startTimer,
          reason,
          userRole,
        });

        const isMyTurn = currentTurn === userRole;
        setIsTurnActive(isMyTurn);

        if (isMyTurn && startTimer) {
          setTimer(60);
        } else {
          setTimer(null);
        }
      });

      socket.on(
        "debate-result",
        (result: { winner: string; reasoning: string }) => {
          console.log("📩 [client] debate-result", result);
          setIsDebateFinished(true);
          setIsTurnActive(false);
          setTimer(null);
          setIsListening(false);
          setDebateResult(result);
        }
      );

      socket.on("opponent-typing", () => {
        setIsTyping(true);
      });

      socket.on("opponent-stop-typing", () => {
        setIsTyping(false);
      });

      socket.on("participant-joined", ({ userName, role }) => {
        console.log(`👤 [client] ${userName} joined as ${role}`);
      });

      socket.on("participant-left", ({ userName, role }) => {
        console.log(`👤 [client] ${userName} (${role}) left the debate`);
      });

      socket.on("error", ({ message }) => {
        console.error("❌ [client] Socket error:", message);
        alert(message);
      });
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    };
  }, [session, debateId, userRole, opponentType]);

  // -- Timer Logic --
  useEffect(() => {
    if (timer === null) return;

    // Timer finished
    if (timer === 0) {
      console.log("Time's up!");

      setIsTurnActive(false);
      setTimer(null);
      setIsListening(false);

      const timeoutMessage: Message = {
        id: crypto.randomUUID(),
        text: "(Time ran out - Turn skipped)",
        timestamp: Date.now(),
      };

      setUserMessages((prev) => [...prev, timeoutMessage]);

      if (opponentType === "human") {
        // Send the message to the opponent so they know you timed out
        socketRef.current?.emit("send-message", {
          debateId,
          message: "(Time ran out - Turn skipped)",
          role: userRole,
          opponentType,
        });
      } else {
        // AI Opponent
        fetchAIResponse(
          "The user ran out of time and did not provide an argument. Please continue the debate by pointing out their silence or continuing your point."
        );
      }

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
    toggleListening();
    const currentInput = userInput;

    // Add new user message to the UI
    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      text: currentInput,
      timestamp: Date.now(),
    };
    setUserMessages((prev) => [...prev, newUserMessage]);

    // Clear input and set loading state
    setUserInput("");
    setIsLoading(true);
    setIsTurnActive(false);
    setTimer(null);
    setIsListening(false);

    try {
      // Send message to either socket server
      if (opponentType === "human") {
        socketRef.current?.emit("stop-typing", { debateId });

        // send message to server
        socketRef.current?.emit("send-message", {
          debateId,
          message: currentInput,
          role: userRole,
          opponentType,
        });
      } else {
        // AI opponent
        await fetchAIResponse(currentInput);
      }
    } catch (error) {
      console.error("Failed to get response from LLM or other user:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        text: "Error getting response from LLM or other user. Check console.",
        timestamp: Date.now(),
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
    from: "user" | "opponent";
  }) => (
    <div
      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm md:text-base ${
        from === "user"
          ? "self-end rounded-br-none bg-blue-600 text-white"
          : "self-start rounded-bl-none bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white"
      }`}
    >
      <div className="mb-1 text-xs opacity-70">
        {from === "user" ? "You" : `${opponentTypeStr} Opponent`}
      </div>
      {message.text}
    </div>
  );

  // --- Helper to format timer ---
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "...";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    // Wrapper
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <header className="z-10 w-full border-b border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-black">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
            <span className="text-zinc-500">Topic: </span>
            {topic}
          </h1>
          <div className="text-xs text-zinc-500">
            Playing as:{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {formatRole(userRole)}
            </span>
          </div>
        </div>
      </header>

      <LinkModal isOpen={modalState} opponentLink={opponentLink} />

      {/* Main Chat Area - Unified Single Column */}
      <main className="flex flex-grow flex-col overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 pb-4">
          {/* Render Combined Messages */}
          {combinedMessages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} from={msg.from} />
          ))}

          {/* Typing / Loading Indicators */}
          {isLoading && (
            <div className="self-start max-w-[80%] rounded-lg rounded-bl-none bg-zinc-200 px-4 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <div className="flex items-center gap-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-100">●</span>
                <span className="animate-bounce delay-200">●</span>
              </div>
            </div>
          )}

          {isTyping && !isLoading && (
            <div className="self-start text-xs text-zinc-400 italic ml-2">
              Opponent is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Footer */}
      <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
          {/* Status Bar (Timer & Turn Indicator) */}
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isTurnActive
                    ? "bg-green-500 animate-pulse"
                    : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              ></div>
              <span
                className={`text-sm font-medium ${
                  !isTurnActive && timer === null
                    ? "text-zinc-500"
                    : "text-zinc-900 dark:text-white"
                }`}
              >
                {isTurnActive ? "Your Turn" : "Waiting for Opponent..."}
              </span>
            </div>
            <span
              className={`font-mono text-sm font-semibold ${
                timer !== null && timer <= 10
                  ? "text-red-600"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {timer !== null && `Time: ${formatTime(timer)}`}
            </span>
          </div>

          {/* Text Input Area */}
          <div className="flex items-start gap-3">
            <div className="relative flex-grow">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  // Optional: Submit on Enter (without shift)
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as unknown as FormEvent);
                  }
                }}
                placeholder={
                  isDebateFinished
                    ? "Debate concluded."
                    : isTurnActive
                    ? isListening
                      ? "Listening..."
                      : "Type your argument here..."
                    : isLoading
                    ? "Opponent is thinking..."
                    : "Time's up! Waiting for opponent."
                }
                rows={1}
                className={`w-full min-h-[3rem] max-h-32 resize-none rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white
                                    ${
                                      isListening
                                        ? "border-red-500 ring-1 ring-red-500"
                                        : "border-zinc-300 dark:border-zinc-700"
                                    }
                                `}
                disabled={isLoading || !isTurnActive || isDebateFinished}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleListening}
                disabled={isLoading || !isTurnActive || isDebateFinished}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-all 
                                    ${
                                      isListening
                                        ? "animate-pulse bg-red-100 text-red-600 hover:bg-red-200"
                                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                                    }`}
                title="Speech to Text"
              >
                <MicIcon isListening={isListening} />
              </button>

              <button
                type="submit"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
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
          <div className="mt-1 text-center text-xs text-zinc-400">
            {isDebateFinished
              ? "Debate Finished"
              : isTurnActive
              ? "Press Enter to send"
              : "Please wait..."}
          </div>
        </form>
      </div>

      {/* --- Result Overlay --- */}
      {debateResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="bg-zinc-50 p-6 text-center dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
                Debate Concluded
              </h3>
              <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                Winner:{" "}
                <span className="text-blue-600">{debateResult.winner}</span>
              </h2>
            </div>

            {/* Body */}
            <div className="p-8">
              <h4 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">
                Judge's Reasoning:
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-lg bg-zinc-50 p-4 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 leading-relaxed">
                {debateResult.reasoning}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-3 bg-zinc-50 p-6 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 justify-end">
              <button
                onClick={() => setDebateResult(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Close & View Chat
              </button>
              <a
                href="/"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      )}
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
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
      >
        <path
          fillRule="evenodd"
          d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6"
    >
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
  );
}
