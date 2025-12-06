// Global Leaderboard - Shows top ranked users
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

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
        .select("user_email, user_name, won, score, user_role");

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

        // Calculate user's actual score (not opponent's)
        // If user won, their score is the score value
        // If user lost, their score is (100 - score value)
        const userScore = result.won ? result.score : 100 - result.score;
        existing.total_score += userScore;

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
          // Sort by wins first, then by avg score
          if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
          return b.avg_score - a.avg_score;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              🏆 Global Leaderboard
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Top debaters ranked by wins and performance
            </p>
          </div>
          <Link
            href="/my-debates"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            View My Debates
          </Link>
        </div>
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="mb-8 flex items-end justify-center gap-4">
          {/* 2nd Place */}
          <PodiumCard entry={leaderboard[1]} rank={2} session={session} />
          {/* 1st Place */}
          <PodiumCard
            entry={leaderboard[0]}
            rank={1}
            session={session}
            isFirst
          />
          {/* 3rd Place */}
          <PodiumCard entry={leaderboard[2]} rank={3} session={session} />
        </div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-3">
        {leaderboard.slice(3, 20).map((entry, index) => {
          const isCurrentUser = session?.user?.email === entry.user_email;
          const rank = index + 4; // Start from 4 since top 3 are shown above

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
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    #{rank}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      {entry.user_name} {isCurrentUser && "(You)"}
                    </p>
                    <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {entry.total_wins}W
                      </span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {entry.total_debates - entry.total_wins}L
                      </span>
                      <span>•</span>
                      <span>{entry.total_debates} Total</span>
                      <span>•</span>
                      <span className="font-medium">
                        {entry.win_rate.toFixed(0)}% WR
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Performance
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {entry.avg_score.toFixed(0)}
                  </p>
                  <p className="text-xs text-zinc-500">/100</p>
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
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  #{userRank.rank}
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {userRank.stats.user_name} (You)
                  </p>
                  <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {userRank.stats.total_wins}W
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {userRank.stats.total_debates - userRank.stats.total_wins}
                      L
                    </span>
                    <span>•</span>
                    <span>{userRank.stats.total_debates} Total</span>
                    <span>•</span>
                    <span className="font-medium">
                      {userRank.stats.win_rate.toFixed(0)}% WR
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Performance</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {userRank.stats.avg_score.toFixed(0)}
                </p>
                <p className="text-xs text-zinc-500">/100</p>
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

function PodiumCard({
  entry,
  rank,
  session,
  isFirst = false,
}: {
  entry: LeaderboardEntry;
  rank: number;
  session: any;
  isFirst?: boolean;
}) {
  const isCurrentUser = session?.user?.email === entry.user_email;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const height = rank === 1 ? "h-48" : rank === 2 ? "h-40" : "h-32";

  return (
    <div className={`flex flex-col items-center ${isFirst ? "w-40" : "w-36"}`}>
      <div className="mb-3 text-center">
        <p className={`text-4xl ${isFirst ? "animate-bounce" : ""}`}>{medal}</p>
        <p
          className={`mt-2 font-bold ${
            isFirst ? "text-lg" : "text-base"
          } text-zinc-900 dark:text-white`}
        >
          {entry.user_name}
          {isCurrentUser && (
            <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">
              (You)
            </span>
          )}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {entry.total_wins}W • {entry.win_rate.toFixed(0)}% WR
        </p>
      </div>
      <div
        className={`w-full rounded-t-lg ${height} ${
          rank === 1
            ? "bg-gradient-to-t from-yellow-400 to-yellow-300 dark:from-yellow-600 dark:to-yellow-500"
            : rank === 2
            ? "bg-gradient-to-t from-zinc-300 to-zinc-200 dark:from-zinc-600 dark:to-zinc-500"
            : "bg-gradient-to-t from-orange-400 to-orange-300 dark:from-orange-600 dark:to-orange-500"
        } flex flex-col items-center justify-center border-2 border-zinc-300 dark:border-zinc-700`}
      >
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Performance
        </p>
        <p className="text-3xl font-bold text-zinc-900 dark:text-white">
          {entry.avg_score.toFixed(0)}
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-200">/100</p>
      </div>
    </div>
  );
}
