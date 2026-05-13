import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// SUPABASE
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const db = {
  getSessions: () => sbFetch("/sessions?order=date.asc"),
  addSession: (s) => sbFetch("/sessions", { method: "POST", body: JSON.stringify(s) }),
  updateSession: (id, s) => sbFetch(`/sessions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(s) }),
  deleteSession: (id) => sbFetch(`/sessions?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal", headers: { "Prefer": "return=minimal" } }),
};

// ============================================================
// STRAVA
// ============================================================
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_SCOPE = "read,activity:read_all";

const STRAVA_TYPE_MAP = {
  Run: "run", TrailRun: "run", VirtualRun: "run",
  Ride: "bike", VirtualRide: "bike", MountainBikeRide: "bike", GravelRide: "bike",
  Swim: "swim",
  WeightTraining: "strength", Workout: "strength", Crossfit: "strength",
  Walk: "walk", Hike: "walk",
  Rowing: "rowing", Kayaking: "rowing",
};

function stravaTypeToSport(type) { return STRAVA_TYPE_MAP[type] || "rest"; }

function parseStravaActivity(a) {
  const distanceKm = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : null;
  const durationMin = Math.round(a.moving_time / 60);
  const elevation = Math.round(a.total_elevation_gain || 0);
  const sport = stravaTypeToSport(a.type);
  let pace = null;
  if (sport === "run" && a.distance > 0) {
    const s = a.moving_time / (a.distance / 1000);
    pace = `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}/km`;
  } else if (sport === "bike" && a.moving_time > 0) {
    pace = `${((a.distance / 1000) / (a.moving_time / 3600)).toFixed(1)} km/h`;
  } else if (sport === "swim" && a.distance > 0) {
    const s = a.moving_time / (a.distance / 100);
    pace = `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}/100m`;
  }
  return {
    id: a.id, date: a.start_date_local?.split("T")[0] || "",
    sport, title: a.name, distance: distanceKm, duration: durationMin,
    elevation, pace, hr: Math.round(a.average_heartrate) || null,
    feel: a.perceived_exertion ? Math.min(5, Math.round(a.perceived_exertion)) : null,
  };
}

const MOCK_STRAVA = [
  { id: 1, date: "2026-05-11", sport: "run", title: "Trail des crêtes", distance: 18.4, duration: 132, elevation: 820, pace: "7:10/km", hr: 158, feel: 4 },
  { id: 2, date: "2026-05-10", sport: "bike", title: "Sortie route matinale", distance: 42, duration: 88, elevation: 320, pace: "28.6 km/h", hr: 148, feel: 5 },
  { id: 3, date: "2026-05-09", sport: "swim", title: "Piscine", distance: 1.8, duration: 45, elevation: 0, pace: "2:30/100m", hr: 142, feel: 3 },
];

// ============================================================
// SPORT CONFIG
// ============================================================
const sportConfig = {
  run:      { icon: "🏃", label: "Course",   color: "#FF6B35", bg: "rgba(255,107,53,0.12)" },
  bike:     { icon: "🚴", label: "Vélo",     color: "#F5C518", bg: "rgba(245,197,24,0.12)" },
  swim:     { icon: "🏊", label: "Natation", color: "#45B7D1", bg: "rgba(69,183,209,0.12)" },
  strength: { icon: "💪", label: "Renfo",    color: "#E03C3C", bg: "rgba(224,60,60,0.12)" },
  walk:     { icon: "🚶", label: "Marche",   color: "#4CAF50", bg: "rgba(76,175,80,0.12)" },
  rowing:   { icon: "🚣", label: "Rameur",   color: "#9E9E9E", bg: "rgba(158,158,158,0.12)" },
  rest:     { icon: "🧘", label: "Repos",    color: "#A8A8A8", bg: "rgba(168,168,168,0.12)" },
};

const feelEmoji = ["", "😩", "😐", "🙂", "😊", "🔥"];

// ============================================================
// HELPERS
// ============================================================
function formatDuration(min) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}` : `${m}min`;
}
function formatDate(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function today() { return new Date().toISOString().split("T")[0]; }
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return (new Date(y, m, 1).getDay() + 6) % 7; }

// ============================================================
// COMPOSANTS PARTAGÉS
// ============================================================
function SportBadge({ sport, small }) {
  const cfg = sportConfig[sport] || sportConfig.rest;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: small ? 3 : 5, padding: small ? "2px 7px" : "4px 10px", background: cfg.bg, borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 600, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 400, color: accent || "#fff", fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10, ...style }}>{children}</div>;
}

function Stat({ icon, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 400, color: "#ccc", fontFamily: "'DM Serif Display', Georgia, serif" }}>{value}</span>
    </div>
  );
}

function SessionCard({ session, big, onEdit, onToggleDone }) {
  const cfg = sportConfig[session.sport] || sportConfig.rest;
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)", border: `1px solid ${cfg.color}33`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 14, padding: big ? "16px" : "12px 14px", marginBottom: 10, opacity: session.done ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }} onClick={() => onToggleDone?.(session)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <SportBadge sport={session.sport} small />
            {session.done && <span style={{ fontSize: 10, color: "#4CAF50", fontWeight: 700 }}>✓ FAIT</span>}
          </div>
          <div style={{ fontSize: big ? 16 : 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{session.title}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{session.detail}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 12 }}>
          {session.distance && <div style={{ fontSize: 16, fontWeight: 400, color: cfg.color, fontFamily: "'DM Serif Display', Georgia, serif" }}>{session.distance} km</div>}
          <div style={{ fontSize: 12, color: "#666" }}>{formatDuration(session.duration)}</div>
          {onEdit && (
            <button onClick={() => onEdit(session)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", borderRadius: 8, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>✏️</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }) {
  const cfg = sportConfig[activity.sport] || sportConfig.rest;
  return (
    <div style={{ background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(255,255,255,0.02) 100%)`, border: `1px solid ${cfg.color}22`, borderRadius: 16, padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <SportBadge sport={activity.sport} small />
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginTop: 8, marginBottom: 2 }}>{activity.title}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{formatDate(activity.date)}</div>
        </div>
        {activity.feel > 0 && <div style={{ fontSize: 24 }}>{feelEmoji[activity.feel]}</div>}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
        {activity.distance && <Stat icon="📍" value={`${activity.distance} km`} />}
        <Stat icon="⏱" value={formatDuration(activity.duration)} />
        {activity.elevation > 0 && <Stat icon="⛰" value={`+${activity.elevation}m`} />}
        {activity.hr > 0 && <Stat icon="❤️" value={`${activity.hr} bpm`} />}
        {activity.pace && <Stat icon="⚡" value={activity.pace} />}
      </div>
    </div>
  );
}

// ============================================================
// FORMULAIRE SÉANCE (ajout / modification)
// ============================================================
const EMPTY_SESSION = { date: today(), sport: "run", title: "", detail: "", distance: "", duration: "" };

function SessionForm({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_SESSION);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    await onSave({
      ...form,
      distance: form.distance ? parseFloat(form.distance) : null,
      duration: form.duration ? parseInt(form.duration) : null,
    });
    setSaving(false);
  };

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };
  const labelStyle = { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#13131F", borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "24px 20px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'DM Serif Display', Georgia, serif" }}>
            {isEdit ? "Modifier la séance" : "Nouvelle séance"}
          </h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#888", borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
        </div>

        {/* Sport */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Sport</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(sportConfig).map(([key, cfg]) => (
              <button key={key} onClick={() => set("sport", key)} style={{
                padding: "8px 14px", borderRadius: 20, border: `1px solid ${form.sport === key ? cfg.color : "rgba(255,255,255,0.1)"}`,
                background: form.sport === key ? cfg.bg : "transparent",
                color: form.sport === key ? cfg.color : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer"
              }}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Titre */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Titre *</label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ex: Sortie endurance fondamentale" style={inputStyle} />
        </div>

        {/* Détail */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Détail / Instructions</label>
          <input value={form.detail || ""} onChange={e => set("detail", e.target.value)} placeholder="Ex: 1h15 Z2 — allure 6:00/km" style={inputStyle} />
        </div>

        {/* Distance + Durée */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Distance (km)</label>
            <input type="number" value={form.distance || ""} onChange={e => set("distance", e.target.value)} placeholder="Ex: 12.5" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Durée (min)</label>
            <input type="number" value={form.duration || ""} onChange={e => set("duration", e.target.value)} placeholder="Ex: 75" style={inputStyle} />
          </div>
        </div>

        {/* Boutons */}
        <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{
          width: "100%", background: saving ? "#555" : "linear-gradient(135deg, #FF6B35, #FF8C5A)",
          border: "none", borderRadius: 14, padding: "15px", color: "#fff", fontSize: 15,
          fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", marginBottom: 12,
          boxShadow: "0 4px 20px rgba(255,107,53,0.3)"
        }}>
          {saving ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Ajouter la séance"}
        </button>

        {isEdit && (
          <button onClick={() => onDelete(initial.id)} style={{
            width: "100%", background: "rgba(224,60,60,0.1)", border: "1px solid rgba(224,60,60,0.3)",
            borderRadius: 14, padding: "13px", color: "#E03C3C", fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>
            Supprimer cette séance
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PAGE: HOME
// ============================================================
function HomePage({ plan, strava, onEditSession, onToggleDone }) {
  const todaySessions = plan.filter(s => s.date === today());
  const lastActivity = strava[0];
  const totalKm = strava.filter(a => a.sport === "run").reduce((a, b) => a + (b.distance || 0), 0);

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ paddingTop: 28, paddingBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>Bonjour 👋</h1>
        <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
          {todaySessions.length > 0 ? `${todaySessions.length} séance${todaySessions.length > 1 ? "s" : ""} aujourd'hui` : "Pas de séance planifiée"}
        </div>
      </div>

      {todaySessions.length > 0 && (
        <>
          <SectionTitle>Séances du jour</SectionTitle>
          {todaySessions.map(s => <SessionCard key={s.id} session={s} big onEdit={onEditSession} onToggleDone={onToggleDone} />)}
        </>
      )}

      {lastActivity && (
        <>
          <SectionTitle style={{ marginTop: 28 }}>Dernière activité Strava</SectionTitle>
          <ActivityCard activity={lastActivity} />
        </>
      )}

      <SectionTitle style={{ marginTop: 28 }}>Cette semaine</SectionTitle>
      <div style={{ display: "flex", gap: 8 }}>
        <StatCard label="Km course" value={`${totalKm.toFixed(0)}`} sub="cette semaine" accent="#FF6B35" />
        <StatCard label="Activités" value={strava.length} sub="7 derniers jours" />
      </div>
    </div>
  );
}

// ============================================================
// PAGE: CALENDRIER
// ============================================================
const navBtn = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 10, width: 36, height: 36, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

function CalendarPage({ plan, onEditSession, onToggleDone, onAddSession }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(today());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const selectedSessions = plan.filter(s => s.date === selectedDay);

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ paddingTop: 28, paddingBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>Calendrier</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => { let m = viewMonth - 1, y = viewYear; if (m < 0) { m = 11; y--; } setViewMonth(m); setViewYear(y); }} style={navBtn}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize" }}>{monthName}</div>
        <button onClick={() => { let m = viewMonth + 1, y = viewYear; if (m > 11) { m = 0; y++; } setViewMonth(m); setViewYear(y); }} style={navBtn}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#666", fontWeight: 700, padding: "4px 0" }}>{d}</div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 24 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const sessions = plan.filter(s => s.date === dateStr);
          const isToday = dateStr === today();
          const isSelected = dateStr === selectedDay;
          const isPast = dateStr < today();
          return (
            <div key={i} onClick={() => setSelectedDay(dateStr)} style={{ borderRadius: 10, padding: "8px 4px", textAlign: "center", cursor: "pointer", background: isSelected ? "#FF6B35" : isToday ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.04)", border: isToday && !isSelected ? "1px solid #FF6B3555" : "1px solid transparent", opacity: isPast && !isToday ? 0.5 : 1, transition: "all 0.15s" }}>
              <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isSelected ? "#fff" : "#ccc" }}>{d}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 3, flexWrap: "wrap" }}>
                {sessions.map(s => <div key={s.id} style={{ width: 5, height: 5, borderRadius: "50%", background: isSelected ? "#fff" : sportConfig[s.sport]?.color || "#888" }} />)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle style={{ marginBottom: 0 }}>{formatDate(selectedDay)}</SectionTitle>
        <button onClick={() => onAddSession(selectedDay)} style={{ background: "#FF6B35", border: "none", borderRadius: 10, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Ajouter</button>
      </div>

      {selectedSessions.length > 0
        ? selectedSessions.map(s => <SessionCard key={s.id} session={s} onEdit={onEditSession} onToggleDone={onToggleDone} />)
        : <div style={{ color: "#666", fontSize: 14, fontStyle: "italic", paddingTop: 8 }}>Pas de séance — appuie sur + pour en ajouter une</div>
      }
    </div>
  );
}

// ============================================================
// PAGE: STRAVA
// ============================================================
function StravaPage({ strava, stravaConnected, onConnect, onDisconnect, loading, syncTime }) {
  const [filter, setFilter] = useState("all");
  const sports = ["all","run","bike","swim","strength","walk"];
  const filtered = filter === "all" ? strava : strava.filter(a => a.sport === filter);
  const totalKm = strava.filter(a => a.distance).reduce((a, b) => a + (b.distance || 0), 0);
  const totalTime = strava.reduce((a, b) => a + b.duration, 0);
  const totalElev = strava.reduce((a, b) => a + b.elevation, 0);

  if (!stravaConnected) {
    return (
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ paddingTop: 28, paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "#FC4C02", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🟠</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>Strava</h1>
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, rgba(252,76,2,0.12) 0%, rgba(252,76,2,0.04) 100%)", border: "1px solid rgba(252,76,2,0.3)", borderRadius: 20, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🟠</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Connecte ton compte Strava</div>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 24, lineHeight: 1.6 }}>Synchronise automatiquement toutes tes activités.</div>
          <button onClick={onConnect} style={{ background: "#FC4C02", border: "none", borderRadius: 14, padding: "14px 28px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>Se connecter avec Strava</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ paddingTop: 28, paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "#FC4C02", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🟠</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>Strava</h1>
          </div>
          <button onClick={onDisconnect} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", borderRadius: 10, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Déconnecter</button>
        </div>
        <div style={{ fontSize: 13, color: "#4CAF50", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50" }} />
          {loading ? "Synchronisation…" : syncTime ? `Synchronisé à ${syncTime}` : "Connecté"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <StatCard label="Km totaux" value={`${totalKm.toFixed(0)}`} accent="#FC4C02" />
        <StatCard label="Temps" value={formatDuration(totalTime)} />
        <StatCard label="D+" value={`${totalElev}m`} accent="#45B7D1" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {sports.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: filter === s ? "#FC4C02" : "rgba(255,255,255,0.07)", color: filter === s ? "#fff" : "#999", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
            {s === "all" ? "Tout" : sportConfig[s]?.icon + " " + sportConfig[s]?.label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><div>Chargement…</div></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.length > 0 ? filtered.map(a => <ActivityCard key={a.id} activity={a} />) : <div style={{ color: "#666", fontSize: 14, fontStyle: "italic" }}>Aucune activité pour ce filtre</div>}
          </div>
      }
    </div>
  );
}

// ============================================================
// PAGE: DASHBOARD
// ============================================================
function DashboardPage({ strava, plan }) {
  const runKm = strava.filter(a => a.sport === "run").reduce((a, b) => a + (b.distance || 0), 0);
  const bikeKm = strava.filter(a => a.sport === "bike").reduce((a, b) => a + (b.distance || 0), 0);
  const swimKm = strava.filter(a => a.sport === "swim").reduce((a, b) => a + (b.distance || 0), 0);
  const totalTime = strava.reduce((a, b) => a + b.duration, 0);
  const doneSessions = plan.filter(s => s.done).length;
  const totalSessions = plan.length;
  const loadData = [42, 38, 55, 48, 62, 58, 71];
  const days = ["L","M","M","J","V","S","D"];
  const maxLoad = Math.max(...loadData);
  const goalProgress = 68;

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ paddingTop: 28, paddingBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>Dashboard</h1>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>7 jours glissants</div>
      </div>

      {/* Objectif */}
      <div style={{ background: "linear-gradient(135deg, rgba(255,107,53,0.15) 0%, rgba(255,107,53,0.05) 100%)", border: "1px solid rgba(255,107,53,0.25)", borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#FF6B35", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Objectif principal</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 3 }}>Trail 50km — Automne 2026</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#FF6B35", fontFamily: "'DM Serif Display', Georgia, serif" }}>{goalProgress}%</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${goalProgress}%`, height: "100%", background: "linear-gradient(90deg, #FF6B35, #FF8C5A)", borderRadius: 8 }} />
        </div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>Préparation en bonne voie · J-142</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label="Course" value={`${runKm.toFixed(0)} km`} accent="#FF6B35" sub="7 jours" />
        <StatCard label="Vélo" value={`${bikeKm.toFixed(0)} km`} accent="#F5C518" sub="7 jours" />
        <StatCard label="Natation" value={`${swimKm.toFixed(1)} km`} accent="#45B7D1" sub="7 jours" />
        <StatCard label="Temps total" value={formatDuration(totalTime)} sub="7 jours" />
      </div>

      {/* Séances réalisées */}
      <SectionTitle>Séances planifiées</SectionTitle>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: "#ccc" }}>Réalisées</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#4CAF50" }}>{doneSessions} / {totalSessions}</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 8 }}>
          <div style={{ width: totalSessions > 0 ? `${(doneSessions / totalSessions) * 100}%` : "0%", height: "100%", background: "#4CAF50", borderRadius: 6 }} />
        </div>
      </div>

      {/* Charge */}
      <SectionTitle>Charge d'entraînement — 7 jours</SectionTitle>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
          {loadData.map((val, i) => {
            const isToday = i === 6;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: isToday ? "#FF6B35" : "#666" }}>{val}</div>
                <div style={{ width: "100%", height: `${(val / maxLoad) * 100}%`, background: isToday ? "#FF6B35" : "rgba(255,255,255,0.12)", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                <div style={{ fontSize: 9, color: isToday ? "#FF6B35" : "#555", fontWeight: isToday ? 700 : 400 }}>{days[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Répartition */}
      <SectionTitle>Répartition des sports</SectionTitle>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        {[{ sport: "run", val: runKm, unit: "km", total: 60 }, { sport: "bike", val: bikeKm, unit: "km", total: 100 }, { sport: "swim", val: swimKm, unit: "km", total: 5 }].map(({ sport, val, unit, total }) => {
          const cfg = sportConfig[sport];
          return (
            <div key={sport} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#ccc" }}>{cfg.icon} {cfg.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{val.toFixed(0)} {unit}</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 6 }}>
                <div style={{ width: `${Math.min((val / total) * 100, 100)}%`, height: "100%", background: cfg.color, borderRadius: 6 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "rgba(69,183,209,0.08)", border: "1px solid rgba(69,183,209,0.2)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 24 }}>✅</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#45B7D1" }}>Forme optimale</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Charge d'entraînement équilibrée.</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COACH IA
// ============================================================
function AIChatBubble({ strava, plan }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: "Salut ! Je suis ton coach IA 🏃 Je peux analyser tes activités Strava, générer ou adapter ton planning. Comment puis-je t'aider ?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const systemPrompt = `Tu es un coach sportif expert en trail, course à pied, triathlon et renforcement musculaire. Réponds toujours en français, de façon concise et motivante.
Activités Strava récentes: ${JSON.stringify(strava.slice(0, 10))}
Planning actuel: ${JSON.stringify(plan)}
Objectif: Trail 50km automne 2026.`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    const history = [...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })), { role: "user", content: userMsg }];
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages: history })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", text: data.content?.map(c => c.text || "").join("") || "Erreur." }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", text: "Erreur de connexion." }]); }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{ position: "fixed", bottom: 90, right: 20, zIndex: 1000, width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg, #FF6B35, #FF8C5A)", border: "none", cursor: "pointer", fontSize: 22, boxShadow: "0 4px 20px rgba(255,107,53,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {open ? "✕" : "🤖"}
      </button>
      {open && (
        <div style={{ position: "fixed", bottom: 155, right: 16, left: 16, zIndex: 999, background: "#1A1A2E", border: "1px solid rgba(255,107,53,0.25)", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", maxHeight: "60vh" }}>
          <div style={{ padding: "14px 16px", background: "rgba(255,107,53,0.1)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🤖 Coach IA</div>
            <div style={{ fontSize: 11, color: "#888" }}>Propulsé par Claude</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "linear-gradient(135deg, #FF6B35, #FF8C5A)" : "rgba(255,255,255,0.07)", fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
              </div>
            ))}
            {loading && <div style={{ display: "flex", gap: 4, padding: "8px 14px" }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6B35", animation: `bounce 0.8s ${i*0.15}s infinite alternate` }} />)}</div>}
            <div ref={bottomRef} />
          </div>
          {messages.length <= 1 && (
            <div style={{ padding: "8px 12px", display: "flex", gap: 6, overflowX: "auto", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {["Génère mon plan semaine", "Analyse mes sorties", "J'ai mal aux jambes"].map((q, i) => (
                <button key={i} onClick={() => setInput(q)} style={{ padding: "6px 12px", borderRadius: 14, background: "rgba(255,107,53,0.12)", border: "1px solid rgba(255,107,53,0.2)", color: "#FF6B35", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{q}</button>
              ))}
            </div>
          )}
          <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Pose ta question..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            <button onClick={send} disabled={loading} style={{ background: "#FF6B35", border: "none", borderRadius: 12, padding: "10px 14px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16 }}>↑</button>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-6px); } }`}</style>
    </>
  );
}

// ============================================================
// BOTTOM NAV
// ============================================================
function BottomNav({ page, setPage }) {
  const tabs = [
    { id: "home", icon: "🏠", label: "Accueil" },
    { id: "calendar", icon: "📅", label: "Calendrier" },
    { id: "strava", icon: "🟠", label: "Strava" },
    { id: "dashboard", icon: "📊", label: "Stats" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(10,10,20,0.92)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", padding: "8px 0 20px" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setPage(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
          <div style={{ fontSize: 20, opacity: page === t.id ? 1 : 0.4, transition: "all 0.15s", transform: page === t.id ? "scale(1.15)" : "scale(1)" }}>{t.icon}</div>
          <div style={{ fontSize: 10, fontWeight: page === t.id ? 700 : 400, color: page === t.id ? "#FF6B35" : "#666" }}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("home");

  // --- Planning (Supabase) ---
  const [plan, setPlan] = useState([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formDate, setFormDate] = useState(today());

  // --- Strava ---
  const [stravaToken, setStravaToken] = useState(() => localStorage.getItem("strava_access_token") || null);
  const [stravaRefresh, setStravaRefresh] = useState(() => localStorage.getItem("strava_refresh_token") || null);
  const [stravaExpires, setStravaExpires] = useState(() => localStorage.getItem("strava_expires_at") || null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [syncTime, setSyncTime] = useState(null);

  const stravaConnected = !!stravaToken;
  const strava = stravaConnected ? stravaActivities : MOCK_STRAVA;

  // ---- Chargement du planning depuis Supabase ----
  const loadPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const data = await db.getSessions();
      setPlan(data);
    } catch (err) {
      console.error("Supabase load error:", err);
    }
    setPlanLoading(false);
  }, []);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ---- Ajouter une séance ----
  const handleAddSession = (date) => {
    setEditingSession(null);
    setFormDate(date || today());
    setShowForm(true);
  };

  // ---- Sauvegarder (ajout ou modif) ----
  const handleSaveSession = async (formData) => {
    try {
      if (editingSession?.id) {
        await db.updateSession(editingSession.id, formData);
      } else {
        await db.addSession({ ...formData, date: formDate });
      }
      await loadPlan();
      setShowForm(false);
      setEditingSession(null);
    } catch (err) {
      console.error("Save error:", err);
      alert("Erreur lors de l'enregistrement. Vérifie ta connexion.");
    }
  };

  // ---- Supprimer ----
  const handleDeleteSession = async (id) => {
    try {
      await db.deleteSession(id);
      await loadPlan();
      setShowForm(false);
      setEditingSession(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ---- Marquer comme fait / pas fait ----
  const handleToggleDone = async (session) => {
    try {
      await db.updateSession(session.id, { done: !session.done });
      await loadPlan();
    } catch (err) { console.error("Toggle error:", err); }
  };

  // ---- Éditer ----
  const handleEditSession = (session) => {
    setEditingSession(session);
    setShowForm(true);
  };

  // ---- Strava OAuth ----
  const saveToken = useCallback((data) => {
    localStorage.setItem("strava_access_token", data.access_token);
    localStorage.setItem("strava_refresh_token", data.refresh_token);
    localStorage.setItem("strava_expires_at", data.expires_at);
    setStravaToken(data.access_token);
    setStravaRefresh(data.refresh_token);
    setStravaExpires(data.expires_at);
  }, []);

  const getValidToken = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    if (stravaExpires && parseInt(stravaExpires) > now + 60) return stravaToken;
    const res = await fetch("/api/strava-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", refresh_token: stravaRefresh }) });
    const data = await res.json();
    if (data.access_token) { saveToken(data); return data.access_token; }
    return null;
  }, [stravaToken, stravaRefresh, stravaExpires, saveToken]);

  const loadActivities = useCallback(async (token) => {
    setStravaLoading(true);
    try {
      const validToken = token || await getValidToken();
      if (!validToken) return;
      const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=30", { headers: { Authorization: `Bearer ${validToken}` } });
      const data = await res.json();
      if (Array.isArray(data)) { setStravaActivities(data.map(parseStravaActivity)); setSyncTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })); }
    } catch (err) { console.error("Strava load error:", err); }
    setStravaLoading(false);
  }, [getValidToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (params.get("error")) { window.history.replaceState({}, "", window.location.pathname); return; }
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      setPage("strava");
      fetch("/api/strava-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, grant_type: "authorization_code" }) })
        .then(r => r.json()).then(data => { if (data.access_token) { saveToken(data); loadActivities(data.access_token); } })
        .catch(console.error);
    }
  }, [saveToken, loadActivities]);

  useEffect(() => { if (stravaToken) loadActivities(); }, []);

  const handleStravaConnect = () => {
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin)}&approval_prompt=auto&scope=${STRAVA_SCOPE}`;
    window.location.href = url;
  };

  const handleStravaDisconnect = () => {
    ["strava_access_token","strava_refresh_token","strava_expires_at"].forEach(k => localStorage.removeItem(k));
    setStravaToken(null); setStravaRefresh(null); setStravaExpires(null); setStravaActivities([]);
  };

  const pages = {
    home: () => <HomePage plan={plan} strava={strava} onEditSession={handleEditSession} onToggleDone={handleToggleDone} />,
    calendar: () => <CalendarPage plan={plan} onEditSession={handleEditSession} onToggleDone={handleToggleDone} onAddSession={handleAddSession} />,
    strava: () => <StravaPage strava={strava} stravaConnected={stravaConnected} onConnect={handleStravaConnect} onDisconnect={handleStravaDisconnect} loading={stravaLoading} syncTime={syncTime} />,
    dashboard: () => <DashboardPage strava={strava} plan={plan} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#fff", fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif", maxWidth: 430, margin: "0 auto", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: #555; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      {planLoading
        ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 36 }}>🏃</div>
            <div style={{ color: "#888", fontSize: 14 }}>Chargement du planning…</div>
          </div>
        : pages[page]?.()
      }

      <BottomNav page={page} setPage={setPage} />
      <AIChatBubble strava={strava} plan={plan} />

      {/* Bouton + flottant sur Accueil */}
      {page === "home" && (
        <button onClick={() => handleAddSession(today())} style={{ position: "fixed", bottom: 90, left: 20, zIndex: 1000, width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>
          +
        </button>
      )}

      {/* Formulaire modal */}
      {showForm && (
        <SessionForm
          initial={editingSession ? { ...editingSession, distance: editingSession.distance?.toString() || "", duration: editingSession.duration?.toString() || "" } : { ...EMPTY_SESSION, date: formDate }}
          onSave={handleSaveSession}
          onDelete={handleDeleteSession}
          onClose={() => { setShowForm(false); setEditingSession(null); }}
        />
      )}
    </div>
  );
}
