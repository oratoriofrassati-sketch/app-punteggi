"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TeamKey = "red_points" | "yellow_points" | "green_points" | "blue_points";

type GameScore = {
  id: string;
  game_date: string;
  category: string | null;
  game_name: string;
  display_order: number | null;
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
  { name: "Rossi", key: "red_points", color: "#ef4444" },
  { name: "Gialli", key: "yellow_points", color: "#facc15" },
  { name: "Verdi", key: "green_points", color: "#22c55e" },
  { name: "Blu", key: "blue_points", color: "#3b82f6" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
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
      .order("display_order", { ascending: true, nullsFirst: false })
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
  const yesterday = yesterdayISO();

  const todayScores = useMemo(
    () => scores.filter((s) => s.game_date === today),
    [scores, today]
  );

  const yesterdayScores = useMemo(
    () => scores.filter((s) => s.game_date === yesterday),
    [scores, yesterday]
  );

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
          <h2 style={styles.panelTitleSmall}>Ieri</h2>
          {yesterdayScores.length === 0 ? (
            <p style={styles.emptySmall}>Nessun punteggio di ieri</p>
          ) : (
            <ScoreTable
              scores={yesterdayScores}
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
        <div>Attività</div>
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
    background: "linear-gradient(135deg, #020617, #111827)",
    color: "white",
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
    background: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 26,
    minHeight: 0,
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
    fontSize: 50,
    lineHeight: 1,
    fontWeight: 950,
  },
  date: {
    margin: 0,
    color: "#e5e7eb",
    fontSize: 21,
    textTransform: "capitalize",
  },
  updated: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: 700,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: 18,
    flex: 1.1,
    minHeight: 0,
  },
  panel: {
    background: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 24,
    minHeight: 0,
    overflow: "hidden",
  },
  todayRankingPanel: {
    background: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 22,
    minHeight: 0,
  },
  panelSmall: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    padding: 20,
    flex: 0.75,
    minHeight: 0,
    overflow: "hidden",
  },
  panelTitle: {
    margin: "0 0 14px",
    fontSize: 32,
  },
  todayRankingTitle: {
    margin: "0 0 14px",
    fontSize: 23,
    lineHeight: 1.1,
  },
  panelTitleSmall: {
    margin: "0 0 10px",
    fontSize: 23,
    color: "#cbd5e1",
  },
  empty: {
    fontSize: 25,
    color: "#cbd5e1",
  },
  emptySmall: {
    fontSize: 18,
    color: "#94a3b8",
  },
  table: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 60px 60px 60px 60px",
    fontSize: 18,
    color: "#cbd5e1",
    fontWeight: 800,
    padding: "0 10px",
  },
  tableHeaderSmall: {
    display: "grid",
    gridTemplateColumns: "1fr 50px 50px 50px 50px",
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: 800,
    padding: "0 10px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 60px 60px 60px 60px",
    alignItems: "center",
    background: "rgba(15,23,42,0.85)",
    borderRadius: 16,
    padding: "12px 10px",
    fontSize: 24,
    fontWeight: 900,
    transition: "background 0.3s, transform 0.3s",
  },
  tableRowSmall: {
    display: "grid",
    gridTemplateColumns: "1fr 50px 50px 50px 50px",
    alignItems: "center",
    background: "rgba(15,23,42,0.7)",
    borderRadius: 13,
    padding: "9px 10px",
    fontSize: 18,
    fontWeight: 800,
    transition: "background 0.3s, transform 0.3s",
  },
  updatedRow: {
    background: "rgba(250,204,21,0.24)",
    boxShadow: "0 0 0 2px rgba(250,204,21,0.75)",
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
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.8,
  },
  gameName: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  red: {
    color: "#f87171",
    textAlign: "center",
  },
  yellow: {
    color: "#fde047",
    textAlign: "center",
  },
  green: {
    color: "#4ade80",
    textAlign: "center",
  },
  blue: {
    color: "#60a5fa",
    textAlign: "center",
  },
  rankingTitle: {
    margin: "0 0 20px",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 950,
  },
  rankingList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  rankingCard: {
    display: "grid",
    gridTemplateColumns: "52px 18px 1fr auto",
    alignItems: "center",
    gap: 13,
    background: "rgba(15,23,42,0.85)",
    borderRadius: 22,
    padding: "20px 18px",
  },
  rankingCardLeader: {
    background: "linear-gradient(135deg, #facc15, #eab308)",
    color: "#111827",
  },
  medal: {
    fontSize: 30,
    fontWeight: 950,
    textAlign: "center",
  },
  teamDot: {
    width: 17,
    height: 17,
    borderRadius: "50%",
  },
  teamName: {
    fontSize: 31,
    fontWeight: 950,
  },
  teamTotal: {
    fontSize: 39,
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
    background: "rgba(15,23,42,0.82)",
    borderRadius: 16,
    padding: "12px 12px",
  },
  compactMedal: {
    fontSize: 20,
    fontWeight: 950,
    textAlign: "center",
  },
  compactTeamDot: {
    width: 13,
    height: 13,
    borderRadius: "50%",
  },
  compactTeamName: {
    fontSize: 20,
    fontWeight: 950,
  },
  compactTeamTotal: {
    fontSize: 24,
    fontWeight: 950,
  },
};