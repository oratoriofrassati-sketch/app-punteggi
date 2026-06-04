"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TeamKey = "red_points" | "yellow_points" | "green_points" | "blue_points";

type GameScore = {
  id: string;
  game_date: string;
  game_name: string;
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

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
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

function getGameRanking(score: GameScore) {
  return teamsBase
    .map((team) => ({
      name: team.name,
      key: team.key,
      points: Number(score[team.key] ?? 0),
    }))
    .sort((a, b) => b.points - a.points);
}

export default function StatistichePage() {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadScores() {
    const { data, error } = await supabase
      .from("game_scores")
      .select("*")
      .order("game_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setScores(data);
    setLoading(false);
  }

  useEffect(() => {
    loadScores();

    const channel = supabase
      .channel("statistiche_realtime")
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

  const generalRanking = useMemo(() => buildRanking(scores), [scores]);

  const wins = useMemo(() => {
    const result: Record<string, number> = {
      Rossi: 0,
      Gialli: 0,
      Verdi: 0,
      Blu: 0,
    };

    for (const score of scores) {
      const ranking = getGameRanking(score);
      if (ranking[0]) result[ranking[0].name] += 1;
    }

    return result;
  }, [scores]);

  const podiums = useMemo(() => {
    const result: Record<string, { first: number; second: number; third: number }> = {
      Rossi: { first: 0, second: 0, third: 0 },
      Gialli: { first: 0, second: 0, third: 0 },
      Verdi: { first: 0, second: 0, third: 0 },
      Blu: { first: 0, second: 0, third: 0 },
    };

    for (const score of scores) {
      const ranking = getGameRanking(score);
      if (ranking[0]) result[ranking[0].name].first += 1;
      if (ranking[1]) result[ranking[1].name].second += 1;
      if (ranking[2]) result[ranking[2].name].third += 1;
    }

    return result;
  }, [scores]);

  const averages = useMemo(() => {
    const count = scores.length || 1;

    return teamsBase.map((team) => ({
      name: team.name,
      color: team.color,
      average:
        scores.reduce((sum, score) => sum + Number(score[team.key] ?? 0), 0) / count,
    }));
  }, [scores]);

  const bestDays = useMemo(() => {
    const byDay: Record<string, Record<TeamKey, number>> = {};

    for (const score of scores) {
      if (!byDay[score.game_date]) {
        byDay[score.game_date] = {
          red_points: 0,
          yellow_points: 0,
          green_points: 0,
          blue_points: 0,
        };
      }

      for (const team of teamsBase) {
        byDay[score.game_date][team.key] += Number(score[team.key] ?? 0);
      }
    }

    return teamsBase.map((team) => {
      let bestDate = "";
      let bestTotal = 0;

      for (const [date, values] of Object.entries(byDay)) {
        if (values[team.key] > bestTotal) {
          bestTotal = values[team.key];
          bestDate = date;
        }
      }

      return {
        name: team.name,
        color: team.color,
        date: bestDate,
        total: bestTotal,
      };
    });
  }, [scores]);

  const trend = useMemo(() => {
    const dates = Array.from(new Set(scores.map((score) => score.game_date))).sort();

    const cumulative: Record<TeamKey, number> = {
      red_points: 0,
      yellow_points: 0,
      green_points: 0,
      blue_points: 0,
    };

    return dates.map((date) => {
      const dayScores = scores.filter((score) => score.game_date === date);

      for (const score of dayScores) {
        for (const team of teamsBase) {
          cumulative[team.key] += Number(score[team.key] ?? 0);
        }
      }

      return {
        date,
        values: { ...cumulative },
      };
    });
  }, [scores]);

  if (loading) {
    return (
      <main style={styles.page}>
        <p>Caricamento statistiche...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Statistiche</h1>
          <p style={styles.subtitle}>Andamento squadre oratorio estivo</p>
        </div>

        <a href="/classifica" style={styles.linkButton}>
          Classifica
        </a>
      </header>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Classifica generale</h2>
        <div style={styles.rankingList}>
          {generalRanking.map((team, index) => (
            <div
              key={team.name}
              style={{
                ...styles.rankingRow,
                ...(index === 0 ? styles.rankingLeader : {}),
              }}
            >
              <span style={styles.position}>{index === 0 ? "🏆" : `${index + 1}°`}</span>
              <span style={{ ...styles.dot, background: team.color }} />
              <strong style={styles.teamName}>{team.name}</strong>
              <strong style={styles.teamTotal}>{team.total}</strong>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Vittorie nei giochi</h2>
        <div style={styles.simpleList}>
          {teamsBase.map((team) => (
            <div key={team.name} style={styles.statRow}>
              <span style={{ ...styles.dot, background: team.color }} />
              <strong>{team.name}</strong>
              <span>{wins[team.name]} vittorie</span>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Podi</h2>
        <div style={styles.podiumHeader}>
          <span>Squadra</span>
          <span>🥇</span>
          <span>🥈</span>
          <span>🥉</span>
        </div>
        {teamsBase.map((team) => (
          <div key={team.name} style={styles.podiumRow}>
            <strong>{team.name}</strong>
            <span>{podiums[team.name].first}</span>
            <span>{podiums[team.name].second}</span>
            <span>{podiums[team.name].third}</span>
          </div>
        ))}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Punti medi per gioco</h2>
        <div style={styles.simpleList}>
          {averages.map((team) => (
            <div key={team.name} style={styles.statRow}>
              <span style={{ ...styles.dot, background: team.color }} />
              <strong>{team.name}</strong>
              <span>{team.average.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Miglior giornata</h2>
        <div style={styles.simpleList}>
          {bestDays.map((team) => (
            <div key={team.name} style={styles.bestDayRow}>
              <div>
                <span style={{ ...styles.dot, background: team.color }} />
                <strong style={styles.bestDayTeam}>{team.name}</strong>
              </div>
              <div style={styles.bestDayData}>
                <strong>{team.total}</strong>
                <span>{team.date ? formatDate(team.date) : "-"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Andamento generale</h2>
        {trend.length === 0 ? (
          <p style={styles.empty}>Nessun dato disponibile.</p>
        ) : (
          <div style={styles.trendList}>
            {trend.map((day) => (
              <div key={day.date} style={styles.trendDay}>
                <strong>{formatDate(day.date)}</strong>
                <div style={styles.trendBars}>
                  {teamsBase.map((team) => {
                    const max = Math.max(
                      ...teamsBase.map((t) => day.values[t.key]),
                      1
                    );
                    const width = `${Math.max(6, (day.values[team.key] / max) * 100)}%`;

                    return (
                      <div key={team.name} style={styles.trendBarRow}>
                        <span style={styles.trendLabel}>{team.name}</span>
                        <div style={styles.trendBarTrack}>
                          <div
                            style={{
                              ...styles.trendBarFill,
                              width,
                              background: team.color,
                            }}
                          />
                        </div>
                        <strong style={styles.trendValue}>{day.values[team.key]}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #020617, #111827)",
    color: "white",
    padding: 16,
    fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1,
    fontWeight: 950,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontWeight: 700,
  },
  linkButton: {
    background: "#38bdf8",
    color: "#082f49",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 900,
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
    fontWeight: 950,
  },
  rankingList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  rankingRow: {
    display: "grid",
    gridTemplateColumns: "48px 16px 1fr auto",
    gap: 12,
    alignItems: "center",
    background: "rgba(15,23,42,0.9)",
    borderRadius: 18,
    padding: "15px 14px",
  },
  rankingLeader: {
    background: "linear-gradient(135deg, #facc15, #eab308)",
    color: "#111827",
  },
  position: {
    fontSize: 24,
    fontWeight: 950,
    textAlign: "center",
  },
  dot: {
    display: "inline-block",
    width: 14,
    height: 14,
    borderRadius: "50%",
  },
  teamName: {
    fontSize: 24,
  },
  teamTotal: {
    fontSize: 28,
  },
  simpleList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  statRow: {
    display: "grid",
    gridTemplateColumns: "16px 1fr auto",
    gap: 10,
    alignItems: "center",
    background: "rgba(15,23,42,0.75)",
    borderRadius: 14,
    padding: 12,
  },
  podiumHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 45px 45px 45px",
    color: "#94a3b8",
    fontWeight: 900,
    padding: "0 12px 8px",
  },
  podiumRow: {
    display: "grid",
    gridTemplateColumns: "1fr 45px 45px 45px",
    background: "rgba(15,23,42,0.75)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  bestDayRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    background: "rgba(15,23,42,0.75)",
    borderRadius: 14,
    padding: 12,
  },
  bestDayTeam: {
    marginLeft: 10,
  },
  bestDayData: {
    display: "flex",
    flexDirection: "column",
    textAlign: "right",
  },
  trendList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  trendDay: {
    background: "rgba(15,23,42,0.75)",
    borderRadius: 16,
    padding: 12,
  },
  trendBars: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  trendBarRow: {
    display: "grid",
    gridTemplateColumns: "58px 1fr 48px",
    gap: 8,
    alignItems: "center",
  },
  trendLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 900,
  },
  trendBarTrack: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  trendValue: {
    textAlign: "right",
  },
  empty: {
    color: "#cbd5e1",
  },
};