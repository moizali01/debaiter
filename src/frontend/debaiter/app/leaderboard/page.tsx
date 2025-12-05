// Global Leaderboard - Shows top ranked users
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "../lib/supabase";

type LeaderboardEntry = {
  user_name: string;
  user_email: string;
  total_wins: number;
  total_debates: number;
  win_rate: number;
  avg_score: number;
};

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{
    rank: number;
    stats: LeaderboardEntry;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [session]);

  const fetchLeaderboard = async () => {
    try {
      // Get all debate results
      const { data, error } = await supabase
        .from("debate_results")
        .select("user_email, user_name, won, score");

      if (error) throw error;

      // Aggregate stats per user
      const userStats = new Map<
        string,
        {
          user_name: string;
          user_email: string;
          total_wins: number;
          total_debates: number;
          total_score: number;
        }
      >();

      data?.forEach((result: any) => {
        const existing = userStats.get(result.user_email) || {
          user_name: result.user_name,
          user_email: result.user_email,
          total_wins: 0,
          total_debates: 0,
          total_score: 0,
        };

        existing.total_debates += 1;
        existing.total_score += result.score;
        if (result.won) existing.total_wins += 1;

        userStats.set(result.user_email, existing);
      });

      // Convert to array and calculate percentages
      const leaderboardData: LeaderboardEntry[] = Array.from(userStats.values())
        .map((stats) => ({
          user_name: stats.user_name,
          user_email: stats.user_email,
          total_wins: stats.total_wins,
          total_debates: stats.total_debates,
          win_rate: (stats.total_wins / stats.total_debates) * 100,
          avg_score: stats.total_score / stats.total_debates,
        }))
        .sort((a, b) => {
          // Sort by wins first, then by win rate
          if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
          return b.win_rate - a.win_rate;
        });

      setLeaderboard(leaderboardData);

      // Find current user's rank
      if (session?.user?.email) {
        const userIndex = leaderboardData.findIndex(
          (entry) => entry.user_email === session.user.email
        );
        if (userIndex !== -1) {
          setUserRank({
            rank: userIndex + 1,
            stats: leaderboardData[userIndex],
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          🏆 Leaderboard
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Top debaters ranked by wins and performance
        </p>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-3">
        {leaderboard.slice(0, 20).map((entry, index) => {
          const isCurrentUser = session?.user?.email === entry.user_email;
          const rank = index + 1;
          const medal =
            rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

          return (
            <div
              key={entry.user_email}
              className={`rounded-lg border p-4 transition-colors ${
                isCurrentUser
                  ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {medal || `#${rank}`}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      {entry.user_name} {isCurrentUser && "(You)"}
                    </p>
                    <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <span>Wins: {entry.total_wins}</span>
                      <span>•</span>
                      <span>Debates: {entry.total_debates}</span>
                      <span>•</span>
                      <span>Win Rate: {entry.win_rate.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">
                    Avg Score
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {entry.avg_score.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User's rank if not in top 20 */}
      {userRank && userRank.rank > 20 && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Your Ranking
          </p>
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  #{userRank.rank}
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {userRank.stats.user_name} (You)
                  </p>
                  <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Wins: {userRank.stats.total_wins}</span>
                    <span>•</span>
                    <span>Debates: {userRank.stats.total_debates}</span>
                    <span>•</span>
                    <span>Win Rate: {userRank.stats.win_rate.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-500">Avg Score</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {userRank.stats.avg_score.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {leaderboard.length === 0 && (
        <div className="py-12 text-center text-zinc-500">
          No debates recorded yet. Be the first!
        </div>
      )}
    </div>
  );
}
