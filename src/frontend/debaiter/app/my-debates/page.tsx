// My Debates - Shows user's debate history with expandable transcripts
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "../lib/supabase";
import { redirect } from "next/navigation";

type DebateRecord = {
  id: string;
  topic: string;
  user_role: "affirmative" | "negative";
  opponent_type: "human" | "ai";
  won: boolean;
  score: number;
  reasoning: string;
  transcript: Array<{ role: string; text: string; timestamp: number }>;
  created_at: string;
};

export default function MyDebatesPage() {
  const { data: session, status } = useSession();
  const [debates, setDebates] = useState<DebateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDebate, setExpandedDebate] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/");
    }
    if (session?.user?.email) {
      fetchDebates();
    }
  }, [session, status]);

  const fetchDebates = async () => {
    try {
      const { data, error } = await supabase
        .from("debate_results")
        .select("*")
        .eq("user_email", session?.user?.email)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDebates(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching debates:", error);
      setLoading(false);
    }
  };

  const toggleTranscript = (debateId: string) => {
    setExpandedDebate(expandedDebate === debateId ? null : debateId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const stats = {
    total: debates.length,
    wins: debates.filter((d) => d.won).length,
    losses: debates.filter((d) => !d.won).length,
    winRate:
      debates.length > 0
        ? (debates.filter((d) => d.won).length / debates.length) * 100
        : 0,
    avgScore:
      debates.length > 0
        ? debates.reduce((sum, d) => sum + d.score, 0) / debates.length
        : 0,
  };

  return (
    <div className="py-8">
      {/* Header with Stats */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          📊 My Debate History
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Debates" value={stats.total} />
          <StatCard
            label="Wins"
            value={stats.wins}
            className="text-green-600"
          />
          <StatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} />
          <StatCard label="Avg Score" value={stats.avgScore.toFixed(1)} />
        </div>
      </div>

      {/* Debate List */}
      <div className="space-y-4">
        {debates.map((debate) => (
          <DebateCard
            key={debate.id}
            debate={debate}
            isExpanded={expandedDebate === debate.id}
            onToggle={() => toggleTranscript(debate.id)}
            userRole={debate.user_role}
          />
        ))}
      </div>

      {debates.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500">
            No debates yet. Start your first debate!
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p
        className={`text-2xl font-bold ${
          className || "text-zinc-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DebateCard({
  debate,
  isExpanded,
  onToggle,
  userRole,
}: {
  debate: DebateRecord;
  isExpanded: boolean;
  onToggle: () => void;
  userRole: string;
}) {
  const date = new Date(debate.created_at).toLocaleString();
  const opponentRole = userRole === "affirmative" ? "negative" : "affirmative";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        debate.won
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                debate.won ? "bg-green-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {debate.won ? "✅ WON" : "❌ LOST"}
            </div>
            <div
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                debate.score >= 70
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : debate.score >= 50
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              Score: {debate.score}
            </div>
          </div>
          <p className="text-sm text-zinc-500">{date}</p>
        </div>

        <h3 className="mt-3 font-semibold text-zinc-900 dark:text-white">
          {debate.topic}
        </h3>

        <div className="mt-2 flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            You:{" "}
            {debate.user_role === "affirmative" ? "Affirmative" : "Negative"}
          </span>
          <span>•</span>
          <span>
            Opponent: {debate.opponent_type === "ai" ? "AI" : "Human"}
          </span>
        </div>

        {/* Judge's Reasoning */}
        <div className="mt-3 rounded-md bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Judge's Reasoning:
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {debate.reasoning}
          </p>
        </div>

        {/* Toggle Transcript Button */}
        <button
          onClick={onToggle}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {isExpanded ? "▼" : "▶"} {isExpanded ? "Hide" : "View"} Transcript
        </button>
      </div>

      {/* Transcript */}
      {isExpanded && debate.transcript && (
        <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-3">
            {debate.transcript
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((msg, idx) => {
                const isUser = msg.role === userRole;
                return (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 ${
                      isUser
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">
                      {isUser ? "🎯 You" : "🔴 Opponent"} (
                      {msg.role === "affirmative" ? "Affirmative" : "Negative"})
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">
                      {msg.text}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
