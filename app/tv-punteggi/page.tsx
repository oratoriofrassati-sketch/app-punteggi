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
  updated_at: string | null;
};

type Team = {
  name: string;
  key: TeamKey;
  color: string;
  total: number;
};

const teamsBase: Omit<Team, "total">[] = [
  { name: "Rossi", key: "red_points", color: "#dc2626" },
  { name: "Gialli", key: "yellow_points", color: "#ca8a04" },
  { name: "Verdi", key: "green_points", color: "#16a34a" },
  { name: "Blu", key: "blue_points", color: "#2563eb" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

export default function TvPunteggiPage() {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [lastChangedId, setLastChangedId] = useState<string | null>(null);

  async function loadScores(changedId?: string) {
    const { data, error } = await supabase
      .from("game_scores")
      .select("*")
      .order("game_date", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setScores(data);
      setLastUpdate(new Date());

      if (changedId) {
        setLastChangedId(changedId);
        setTimeout(() => setLastChangedId(null), 3000);
      }
    }
  }

  useEffect(() => {
    loadScores();

    const channel = supabase
      .channel("game_scores_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_scores" },
        (payload) => {
          const changedId =
            "id" in payload.new && typeof payload.new.id === "string"
              ? payload.new.id
              : null;

          loadScores(changedId ?? undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const today = todayISO();

  const todayScores = useMemo(
    () => scores.filter((s) => s.game_date === today),
    [scores, today]
  );

  const previousGameDate = useMemo(() => {
    const previousDates = [
      ...new Set(
        scores
          .filter((s) => s.game_date < today)
          .map((s) => s.game_date)
      ),
    ];

    return previousDates[0] ?? null;
  }, [scores, today]);

  const previousScores = useMemo(() => {
    if (!previousGameDate) return [];

    return scores.filter((s) => s.game_date === previousGameDate);
  }, [scores, previousGameDate]);

  const todayRanking = useMemo(() => buildRanking(todayScores), [todayScores]);
  const generalRanking = useMemo(() => buildRanking(scores), [scores]);

  return (
    <main style={styles.page}>
      <section style={styles.leftColumn}>
        <div style={styles.header}>
          <h1 style={styles.title}>Punteggi giochi</h1>
          <div style={styles.headerRight}>
            <p style={styles.date}>{formatDate(today)}</p>
            <p style={styles.updated}>Aggiornato alle {formatTime(lastUpdate)}</p>
          </div>
        </div>

        <div style={styles.contentGrid}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Oggi</h2>
            {todayScores.length === 0 ? (
              <p style={styles.empty}>Nessun punteggio inserito oggi</p>
            ) : (
              <ScoreTable scores={todayScores} lastChangedId={lastChangedId} />
            )}
          </div>

          <div style={styles.todayRankingPanel}>
            <h2 style={styles.todayRankingTitle}>Classifica di oggi</h2>
            <RankingList teams={todayRanking} compact />
          </div>
        </div>

        <div style={styles.panelSmall}>
          <h2 style={styles.panelTitleSmall}>
            Ultimo giorno di gioco
            {previousGameDate ? ` · ${formatDate(previousGameDate)}` : ""}
          </h2>

          {previousScores.length === 0 ? (
            <p style={styles.emptySmall}>
              Nessun punteggio precedente disponibile
            </p>
          ) : (
            <ScoreTable
              scores={previousScores}
              small
              lastChangedId={lastChangedId}
            />
          )}
        </div>
      </section>

      <section style={styles.rightColumn}>
        <h2 style={styles.rankingTitle}>Classifica generale</h2>
        <RankingList teams={generalRanking} highlightLeader />
      </section>
    </main>
  );
}

function ScoreTable({
  scores,
  small = false,
  lastChangedId,
}: {
  scores: GameScore[];
  small?: boolean;
  lastChangedId: string | null;
}) {
  return (
    <div style={styles.table}>
      <div style={small ? styles.tableHeaderSmall : styles.tableHeader}>
        <div>Gioco</div>
        <div>R</div>
        <div>G</div>
        <div>V</div>
        <div>B</div>
      </div>

      {scores.map((score) => {
        const isChanged = score.id === lastChangedId;

        return (
          <div
            key={score.id}
            style={{
              ...(small ? styles.tableRowSmall : styles.tableRow),
              ...(isChanged ? styles.updatedRow : {}),
            }}
          >
            <div style={styles.gameCell}>
              {isChanged && <span style={styles.newBadge}>NUOVO</span>}
              <strong style={styles.gameName}>{score.game_name}</strong>
            </div>
            <div style={styles.red}>{score.red_points}</div>
            <div style={styles.yellow}>{score.yellow_points}</div>
            <div style={styles.green}>{score.green_points}</div>
            <div style={styles.blue}>{score.blue_points}</div>
          </div>
        );
      })}
    </div>
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
    <div style={compact ? styles.compactRankingList : styles.rankingList}>
      {teams.map((team, index) => {
        const isLeader = highlightLeader && index === 0;

        return (
          <div
            key={team.name}
            style={{
              ...(compact ? styles.compactRankingCard : styles.rankingCard),
              ...(isLeader ? styles.rankingCardLeader : {}),
            }}
          >
            <div style={compact ? styles.compactMedal : styles.medal}>
              {isLeader ? "🏆" : `${index + 1}°`}
            </div>
            <div
              style={{
                ...(compact ? styles.compactTeamDot : styles.teamDot),
                background: team.color,
              }}
            />
            <div style={compact ? styles.compactTeamName : styles.teamName}>
              {team.name}
            </div>
            <div style={compact ? styles.compactTeamTotal : styles.teamTotal}>
              {team.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#f8fafc",
    color: "#0f172a",
    display: "grid",
    gridTemplateColumns: "70% 30%",
    gap: 24,
    padding: 24,
    fontFamily: "system-ui, sans-serif",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minHeight: 0,
  },
  rightColumn: {
    background: "#ffffff",
    border: "3px solid #cbd5e1",
    borderRadius: 28,
    padding: 26,
    minHeight: 0,
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "end",
  },
  headerRight: {
    textAlign: "right",
  },
  title: {
    margin: 0,
    fontSize: 54,
    lineHeight: 1,
    fontWeight: 950,
    color: "#020617",
  },
  date: {
    margin: 0,
    color: "#1e293b",
    fontSize: 23,
    textTransform: "capitalize",
    fontWeight: 900,
  },
  updated: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 16,
    fontWeight: 800,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: 18,
    flex: 1.1,
    minHeight: 0,
  },
  panel: {
    background: "#ffffff",
    border: "3px solid #cbd5e1",
    borderRadius: 28,
    padding: 24,
    minHeight: 0,
    overflow: "hidden",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  },
  todayRankingPanel: {
    background: "#ffffff",
    border: "3px solid #cbd5e1",
    borderRadius: 28,
    padding: 22,
    minHeight: 0,
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  },
  panelSmall: {
    background: "#ffffff",
    border: "3px solid #cbd5e1",
    borderRadius: 24,
    padding: 20,
    flex: 0.75,
    minHeight: 0,
    overflow: "hidden",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  },
  panelTitle: {
    margin: "0 0 14px",
    fontSize: 34,
    color: "#020617",
    fontWeight: 950,
  },
  todayRankingTitle: {
    margin: "0 0 14px",
    fontSize: 24,
    lineHeight: 1.1,
    color: "#020617",
    fontWeight: 950,
  },
  panelTitleSmall: {
    margin: "0 0 10px",
    fontSize: 24,
    color: "#334155",
    fontWeight: 950,
  },
  empty: {
    fontSize: 25,
    color: "#475569",
    fontWeight: 800,
  },
  emptySmall: {
    fontSize: 18,
    color: "#64748b",
    fontWeight: 800,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 64px 64px 64px 64px",
    fontSize: 19,
    color: "#334155",
    fontWeight: 950,
    padding: "0 10px",
  },
  tableHeaderSmall: {
    display: "grid",
    gridTemplateColumns: "1fr 52px 52px 52px 52px",
    fontSize: 17,
    color: "#475569",
    fontWeight: 950,
    padding: "0 10px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 64px 64px 64px 64px",
    alignItems: "center",
    background: "#f1f5f9",
    border: "2px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 10px",
    fontSize: 26,
    fontWeight: 950,
    transition: "background 0.3s, transform 0.3s",
  },
  tableRowSmall: {
    display: "grid",
    gridTemplateColumns: "1fr 52px 52px 52px 52px",
    alignItems: "center",
    background: "#f1f5f9",
    border: "2px solid #cbd5e1",
    borderRadius: 13,
    padding: "9px 10px",
    fontSize: 19,
    fontWeight: 900,
    transition: "background 0.3s, transform 0.3s",
  },
  updatedRow: {
    background: "#fef08a",
    boxShadow: "0 0 0 4px rgba(202,138,4,0.5)",
    transform: "scale(1.01)",
  },
  gameCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingLeft: 6,
    minWidth: 0,
  },
  newBadge: {
    color: "#854d0e",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.8,
  },
  gameName: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    color: "#020617",
  },
  red: {
    color: "#dc2626",
    textAlign: "center",
  },
  yellow: {
    color: "#ca8a04",
    textAlign: "center",
  },
  green: {
    color: "#16a34a",
    textAlign: "center",
  },
  blue: {
    color: "#2563eb",
    textAlign: "center",
  },
  rankingTitle: {
    margin: "0 0 20px",
    fontSize: 36,
    lineHeight: 1,
    fontWeight: 950,
    color: "#020617",
  },
  rankingList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  rankingCard: {
    display: "grid",
    gridTemplateColumns: "54px 18px 1fr auto",
    alignItems: "center",
    gap: 13,
    background: "#f1f5f9",
    border: "2px solid #cbd5e1",
    borderRadius: 22,
    padding: "20px 18px",
  },
  rankingCardLeader: {
    background: "#facc15",
    border: "3px solid #ca8a04",
    color: "#111827",
  },
  medal: {
    fontSize: 32,
    fontWeight: 950,
    textAlign: "center",
  },
  teamDot: {
    width: 18,
    height: 18,
    borderRadius: "50%",
  },
  teamName: {
    fontSize: 34,
    fontWeight: 950,
  },
  teamTotal: {
    fontSize: 56,
    lineHeight: 1,
    fontWeight: 950,
  },
  compactRankingList: {
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },
  compactRankingCard: {
    display: "grid",
    gridTemplateColumns: "38px 14px 1fr auto",
    alignItems: "center",
    gap: 10,
    background: "#f1f5f9",
    border: "2px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 12px",
  },
  compactMedal: {
    fontSize: 21,
    fontWeight: 950,
    textAlign: "center",
  },
  compactTeamDot: {
    width: 13,
    height: 13,
    borderRadius: "50%",
  },
  compactTeamName: {
    fontSize: 21,
    fontWeight: 950,
  },
  compactTeamTotal: {
    fontSize: 28,
    fontWeight: 950,
  },
};