"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TestPage() {
  const [ok, setOk] = useState("Caricamento...");

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from("game_scores")
        .select("*")
        .limit(1);

      if (error) {
        setOk("ERRORE: " + error.message);
      } else {
        setOk("Connessione Supabase OK");
      }
    }

    test();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>{ok}</h1>
    </div>
  );
}