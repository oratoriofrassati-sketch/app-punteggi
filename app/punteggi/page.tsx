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
};

const teams: { label: string; key: TeamKey }[] = [
  { label: "Rossi", key: "red_points" },
  { label: "Gialli", key: "yellow_points" },
  { label: "Verdi", key: "green_points" },
  { label: "Blu", key: "blue_points" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PunteggiPage() {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [mode, setMode] = useState<"manual" | "ranking">("manual");
  const [gameDate, setGameDate] = useState(todayISO());
  const [gameName, setGameName] = useState("");

  const [positionPoints, setPositionPoints] = useState([100, 80, 60, 40]);

  const [points, setPoints] = useState<Record<TeamKey, number>>({
    red_points: 0,
    yellow_points: 0,
    green_points: 0,
    blue_points: 0,
  });

  const [rankingOrder, setRankingOrder] = useState<TeamKey[]>([
    "red_points",
    "yellow_points",
    "green_points",
    "blue_points",
  ]);

  async function loadScores() {
    const { data, error } = await supabase
      .from("game_scores")
      .select("*")
      .order("game_date", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) setScores(data);
    setLoading(false);
  }

  useEffect(() => {
    loadScores();
  }, []);

  const filteredScores = useMemo(
    () => scores.filter((s) => s.game_date === gameDate),
    [scores, gameDate]
  );

  function resetForm() {
    setEditingId(null);
    setGameName("");
    setPoints({
      red_points: 0,
      yellow_points: 0,
      green_points: 0,
      blue_points: 0,
    });
    setRankingOrder(["red_points", "yellow_points", "green_points", "blue_points"]);
    setMode("manual");
  }

  function editScore(score: GameScore) {
    setEditingId(score.id);
    setGameDate(score.game_date);
    setGameName(score.game_name);
    setMode("manual");
    setPoints({
      red_points: score.red_points,
      yellow_points: score.yellow_points,
      green_points: score.green_points,
      blue_points: score.blue_points,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function moveTeam(index: number, direction: -1 | 1) {
    const next = [...rankingOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRankingOrder(next);
  }

  function updatePositionPoint(index: number, value: number) {
    const next = [...positionPoints];
    next[index] = value;
    setPositionPoints(next);
  }

  async function saveScore(e: React.FormEvent) {
    e.preventDefault();

    if (!gameName.trim()) {
      alert("Inserisci il nome del gioco.");
      return;
    }

    const finalPoints =
      mode === "manual"
        ? points
        : rankingOrder.reduce(
            (acc, teamKey, index) => {
              acc[teamKey] = positionPoints[index];
              return acc;
            },
            {
              red_points: 0,
              yellow_points: 0,
              green_points: 0,
              blue_points: 0,
            } as Record<TeamKey, number>
          );

    setSaving(true);

    const payload = {
      game_date: gameDate,
      category: "Gioco",
      game_name: gameName.trim(),
      red_points: finalPoints.red_points,
      yellow_points: finalPoints.yellow_points,
      green_points: finalPoints.green_points,
      blue_points: finalPoints.blue_points,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await supabase.from("game_scores").update(payload).eq("id", editingId)
      : await supabase.from("game_scores").insert(payload);

    setSaving(false);

    if (error) {
      alert("Errore salvataggio: " + error.message);
      return;
    }

    resetForm();
    loadScores();
  }

  async function deleteScore(id: string) {
    if (!confirm("Eliminare questo punteggio?")) return;

    const { error } = await supabase.from("game_scores").delete().eq("id", id);

    if (error) {
      alert("Errore eliminazione: " + error.message);
      return;
    }

    if (editingId === id) resetForm();
    loadScores();
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Pannello punteggi</h1>
            <p style={styles.subtitle}>Inserimento risultati oratorio estivo</p>
          </div>

          <a href="/classifica" target="_blank" style={styles.tvLink}>
            Apri Classifica
          </a>
        </div>

        {editingId && (
          <div style={styles.editBanner}>
            <span>Stai modificando un punteggio già inserito.</span>
            <button type="button" onClick={resetForm} style={styles.cancelEditButton}>
              Annulla modifica
            </button>
          </div>
        )}

        <form onSubmit={saveScore} style={styles.form}>
          <label style={styles.label}>
            Data
            <input
              type="date"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Nome gioco
            <input
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Es. Rubabandiera"
              style={styles.input}
            />
          </label>

          {!editingId && (
            <div style={styles.modeSelector}>
              <button
                type="button"
                onClick={() => setMode("manual")}
                style={mode === "manual" ? styles.modeButtonActive : styles.modeButton}
              >
                Punti manuali
              </button>
              <button
                type="button"
                onClick={() => setMode("ranking")}
                style={mode === "ranking" ? styles.modeButtonActive : styles.modeButton}
              >
                Classifica gioco
              </button>
            </div>
          )}

          {mode === "manual" ? (
            <div style={styles.grid}>
              {teams.map((team) => (
                <label key={team.key} style={styles.label}>
                  {team.label}
                  <input
                    type="number"
                    min="0"
                    value={points[team.key]}
                    onChange={(e) =>
                      setPoints({ ...points, [team.key]: Number(e.target.value) })
                    }
                    style={styles.input}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div style={styles.rankingInput}>
              <div style={styles.defaultPointsBox}>
                <strong>Punti assegnati per posizione</strong>
                <div style={styles.defaultPointsGrid}>
                  {positionPoints.map((value, index) => (
                    <label key={index} style={styles.label}>
                      {index + 1}° posto
                      <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) =>
                          updatePositionPoint(index, Number(e.target.value))
                        }
                        style={styles.input}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {rankingOrder.map((teamKey, index) => {
                const team = teams.find((t) => t.key === teamKey)!;

                return (
                  <div key={teamKey} style={styles.rankingInputRow}>
                    <strong>{index + 1}°</strong>
                    <span>{team.label}</span>
                    <span>{positionPoints[index]} punti</span>
                    <div style={styles.rowButtons}>
                      <button
                        type="button"
                        onClick={() => moveTeam(index, -1)}
                        style={styles.smallButton}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTeam(index, 1)}
                        style={styles.smallButton}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button type="submit" disabled={saving} style={styles.button}>
            {saving
              ? "Salvataggio..."
              : editingId
              ? "Aggiorna punteggio"
              : "Salva punteggio"}
          </button>
        </form>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Punteggi del giorno selezionato</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : filteredScores.length === 0 ? (
          <p>Nessun punteggio inserito per questa data.</p>
        ) : (
          <div style={styles.list}>
            {filteredScores.map((score) => (
              <div key={score.id} style={styles.scoreRow}>
                <div style={styles.scoreInfo}>
                  <strong>{score.game_name}</strong>
                  <div style={styles.points}>
                    Rossi {score.red_points} · Gialli {score.yellow_points} · Verdi{" "}
                    {score.green_points} · Blu {score.blue_points}
                  </div>
                </div>

                <div style={styles.actions}>
                  <button onClick={() => editScore(score)} style={styles.editButton}>
                    Modifica
                  </button>
                  <button onClick={() => deleteScore(score.id)} style={styles.deleteButton}>
                    Elimina
                  </button>
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
    background: "#111827",
    color: "white",
    padding: 16,
    fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box",
  },
  card: {
    maxWidth: 900,
    width: "100%",
    boxSizing: "border-box",
    margin: "0 auto 24px",
    background: "#1f2937",
    borderRadius: 18,
    padding: 24,
    overflow: "hidden",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "clamp(34px, 9vw, 56px)",
    margin: 0,
    lineHeight: 1.05,
  },
  subtitle: {
    color: "#cbd5e1",
    marginTop: 8,
    fontSize: 18,
    lineHeight: 1.4,
  },
  tvLink: {
    background: "#38bdf8",
    color: "#082f49",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  editBanner: {
    marginTop: 20,
    background: "#78350f",
    border: "1px solid #facc15",
    color: "#fef3c7",
    padding: 14,
    borderRadius: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    fontWeight: 800,
  },
  cancelEditButton: {
    background: "#fef3c7",
    color: "#78350f",
    border: 0,
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginTop: 24,
    width: "100%",
    boxSizing: "border-box",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontWeight: 700,
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  },
  input: {
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #475569",
    background: "#0f172a",
    color: "white",
    fontSize: 18,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  modeSelector: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  modeButton: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #475569",
    background: "#0f172a",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 16,
  },
  modeButtonActive: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #facc15",
    background: "#facc15",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 16,
  },
  defaultPointsBox: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 14,
    border: "1px solid #334155",
  },
  defaultPointsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  rankingInput: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  rankingInputRow: {
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    alignItems: "center",
    gap: 10,
    background: "#0f172a",
    padding: 14,
    borderRadius: 12,
  },
  rowButtons: {
    display: "flex",
    gap: 8,
    gridColumn: "1 / -1",
  },
  smallButton: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #475569",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  button: {
    padding: "16px 18px",
    borderRadius: 14,
    border: 0,
    background: "#facc15",
    color: "#111827",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
  },
  sectionTitle: {
    marginTop: 0,
    fontSize: 24,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  scoreRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    background: "#0f172a",
    padding: 16,
    borderRadius: 14,
    flexWrap: "wrap",
  },
  scoreInfo: {
    minWidth: 0,
    flex: "1 1 220px",
  },
  points: {
    marginTop: 6,
    color: "#cbd5e1",
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  editButton: {
    background: "#38bdf8",
    color: "#082f49",
    border: 0,
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  deleteButton: {
    background: "#ef4444",
    color: "white",
    border: 0,
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
};