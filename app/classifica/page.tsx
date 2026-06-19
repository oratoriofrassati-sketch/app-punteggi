"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TeamKey = "red_points" | "yellow_points" | "green_points" | "blue_points";

type GameScore = {
  id: string;
  game_date: string;
  game_name: string;
  display_order: number | null;
  red_points: number;
  yellow_points: number;
  green_points: number;
  blue_points: number;
  created_at: string;
};

type Team = {
  name: string;
  key: TeamKey;
  color: string;
  total: number;
};

const teamsBase: Omit<Team, "total">[] = [
  { name: "Rossi", key: "red_points", color: "#ef4444" },
  { name: "Gialli", key: "yellow_points", color: "#facc15" },
  { name: "Verdi", key: "green_points", color: "#22c55e" },
  { name: "Blu", key: "blue_points", color: "#3b82f6" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRanking(scores: GameScore[]): Team[] {
  return teamsBase
    .map((team) => ({
      ...team,
      total: scores.reduce((sum, score) => sum + Number(score[team.key] ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);
}

export default function ClassificaMobilePage() {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  async function loadScores() {
    const { data, error } = await supabase
      .from("game_scores")
      .select("*")
      .order("game_date", { ascending: false })
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setScores(data);
      setLastUpdate(new Date());
    }
  }

  useEffect(() => {
    loadScores();

    const channel = supabase
      .channel("classifica_mobile_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_scores" },
        () => loadScores()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const today = todayISO();

  const todayScores = useMemo(
    () => scores.filter((score) => score.game_date === today),
    [scores, today]
  );

  const previousGameDate = useMemo(() => {
    const previousDates = [
      ...new Set(
        scores
          .filter((score) => score.game_date < today)
          .map((score) => score.game_date)
      ),
    ];

    return previousDates[0] ?? null;
  }, [scores, today]);

  const previousScores = useMemo(() => {
    if (!previousGameDate) return [];

    return scores.filter((score) => score.game_date === previousGameDate);
  }, [scores, previousGameDate]);

  const generalRanking = useMemo(() => buildRanking(scores), [scores]);
  const todayRanking = useMemo(() => buildRanking(todayScores), [todayScores]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Classifica squadre</h1>
        <p style={styles.updated}>Aggiornato alle {formatTime(lastUpdate)}</p>
      </header>

      <a href="/statistiche" style={styles.statsButton}>
        Statistiche
      </a>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Classifica generale</h2>
        <RankingList teams={generalRanking} highlightLeader />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Classifica di oggi</h2>
        <RankingList teams={todayRanking} compact />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Punteggi di oggi</h2>
        {todayScores.length === 0 ? (
          <p style={styles.empty}>Nessun punteggio inserito oggi.</p>
        ) : (
          <ScoreList scores={todayScores} />
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitleMuted}>
          Ultimo giorno di gioco
          {previousGameDate ? ` · ${formatDate(previousGameDate)}` : ""}
        </h2>

        {previousScores.length === 0 ? (
          <p style={styles.empty}>Nessun punteggio precedente disponibile.</p>
        ) : (
          <ScoreList scores={previousScores} small />
        )}
      </section>
    </main>
  );
}

function RankingList({
  teams,
  compact = false,
  highlightLeader = false,
}: {
  teams: Team[];
  compact?: boolean;
  highlightLeader?: boolean;
}) {
  return (
    <div style={styles.rankingList}>
      {teams.map((team, index) => {
        const isLeader = highlightLeader && index === 0;

        return (
          <div
            key={team.name}
            style={{
              ...(compact ? styles.rankingRowCompact : styles.rankingRow),
              ...(isLeader ? styles.rankingLeader : {}),
            }}
          >
            <div style={compact ? styles.positionCompact : styles.position}>
              {isLeader ? "🏆" : `${index + 1}°`}
            </div>
            <div style={{ ...styles.dot, background: team.color }} />
            <div style={compact ? styles.teamNameCompact : styles.teamName}>
              {team.name}
            </div>
            <div style={compact ? styles.teamTotalCompact : styles.teamTotal}>
              {team.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreList({
  scores,
  small = false,
}: {
  scores: GameScore[];
  small?: boolean;
}) {
  return (
    <div style={styles.scoreList}>
      {scores.map((score) => (
        <div key={score.id} style={small ? styles.scoreRowSmall : styles.scoreRow}>
          <div style={styles.scoreTitle}>{score.game_name}</div>
          <div style={styles.scoreGrid}>
            <Score label="R" value={score.red_points} color="#f87171" />
            <Score label="G" value={score.yellow_points} color="#fde047" />
            <Score label="V" value={score.green_points} color="#4ade80" />
            <Score label="B" value={score.blue_points} color="#60a5fa" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Score({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={styles.scoreBox}>
      <span style={styles.scoreLabel}>{label}</span>
      <strong style={{ ...styles.scoreValue, color }}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #020617, #111827)",
    color: "white",
    padding: 16,
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 950,
  },
  updated: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: 700,
  },
  card: {
    background: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 24,
    fontWeight: 900,
  },
  sectionTitleMuted: {
    margin: "0 0 14px",
    fontSize: 22,
    fontWeight: 900,
    color: "#cbd5e1",
  },
  empty: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 16,
  },
  rankingList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  rankingRow: {
    display: "grid",
    gridTemplateColumns: "48px 16px 1fr auto",
    alignItems: "center",
    gap: 12,
    background: "rgba(15,23,42,0.9)",
    borderRadius: 18,
    padding: "16px 14px",
  },
  rankingRowCompact: {
    display: "grid",
    gridTemplateColumns: "42px 14px 1fr auto",
    alignItems: "center",
    gap: 10,
    background: "rgba(15,23,42,0.75)",
    borderRadius: 16,
    padding: "12px 12px",
  },
  rankingLeader: {
    background: "linear-gradient(135deg, #facc15, #eab308)",
    color: "#111827",
  },
  position: {
    fontSize: 26,
    fontWeight: 950,
    textAlign: "center",
  },
  positionCompact: {
    fontSize: 20,
    fontWeight: 950,
    textAlign: "center",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
  },
  teamName: {
    fontSize: 26,
    fontWeight: 950,
  },
  teamNameCompact: {
    fontSize: 20,
    fontWeight: 900,
  },
  teamTotal: {
    fontSize: 32,
    fontWeight: 950,
  },
  teamTotalCompact: {
    fontSize: 24,
    fontWeight: 950,
  },
  scoreList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  scoreRow: {
    background: "rgba(15,23,42,0.85)",
    borderRadius: 16,
    padding: 14,
  },
  scoreRowSmall: {
    background: "rgba(15,23,42,0.65)",
    borderRadius: 14,
    padding: 12,
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: 900,
    marginBottom: 10,
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  scoreBox: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "8px 6px",
    textAlign: "center",
  },
  scoreLabel: {
    display: "block",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 900,
  },
  scoreValue: {
    display: "block",
    fontSize: 22,
    fontWeight: 950,
  },
  statsButton: {
    display: "inline-block",
    background: "#facc15",
    color: "#111827",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 900,
    marginTop: 10,
    marginBottom: 14,
  },
};