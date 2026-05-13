import { useState, useEffect, useRef, useCallback } from "react";

const MOCK_PLAN = [
  { id: 1, date: "2026-05-12", sport: "run", title: "Sortie endurance fondamentale", detail: "1h15 Z2 — allure 6:00/km", done: false, distance: 12.5, duration: 75 },
  { id: 2, date: "2026-05-12", sport: "strength", title: "Renforcement gainage", detail: "30min — core + hanches", done: false, distance: null, duration: 30 },
  { id: 3, date: "2026-05-13", sport: "bike", title: "Vélo récupération active", detail: "45min Z1 — cadence 90rpm", done: false, distance: 22, duration: 45 },
  { id: 4, date: "2026-05-14", sport: "swim", title: "Natation technique", detail: "1500m — travail crawl", done: false, distance: 1.5, duration: 40 },
  { id: 5, date: "2026-05-15", sport: "run", title: "Fractionné court", detail: "10x400m — allure 4:30/km", done: false, distance: 9, duration: 60 },
  { id: 6, date: "2026-05-16", sport: "rest", title: "Repos actif / Mobilité", detail: "Étirements 20min", done: false, distance: null, duration: 20 },
  { id: 7, date: "2026-05-17", sport: "run", title: "Sortie longue trail", detail: "2h30 — D+ 600m — Z2/Z3", done: false, distance: 24, duration: 150 },
  { id: 8, date: "2026-05-18", sport: "swim", title: "Natation endurance", detail: "2000m continus", done: false, distance: 2, duration: 50 },
  { id: 9, date: "2026-05-19", sport: "bike", title: "Sortie vélo seuil", detail: "1h30 — 3x15min Z4", done: false, distance: 45, duration: 90 },
  { id: 10, date: "2026-05-20", sport: "run", title: "Run côtes", detail: "8x200m côtes — récup descente trot", done: false, distance: 8, duration: 55 },
];

const MOCK_STRAVA = [
  { id: 1, date: "2026-05-11", sport: "run", title: "Trail des crêtes", distance: 18.4, duration: 132, elevation: 820, pace: "7:10", hr: 158, feel: 4 },
  { id: 2, date: "2026-05-10", sport: "bike", title: "Sortie route matinale", distance: 42, duration: 88, elevation: 320, pace: "28.6km/h", hr: 148, feel: 5 },
  { id: 3, date: "2026-05-09", sport: "swim", title: "Piscine", distance: 1.8, duration: 45, elevation: 0, pace: "2:30/100m", hr: 142, feel: 3 },
  { id: 4, date: "2026-05-08", sport: "run", title: "Endurance fondamentale", distance: 13.2, duration: 78, elevation: 180, pace: "5:54", hr: 145, feel: 5 },
  { id: 5, date: "2026-05-07", sport: "strength", title: "Renforcement musculaire", distance: null, duration: 35, elevation: 0, pace: null, hr: 130, feel: 4 },
  { id: 6, date: "2026-05-06", sport: "run", title: "Fractionné piste", distance: 10.5, duration: 65, elevation: 40, pace: "4:45", hr: 172, feel: 3 },
];

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

function stravaTypeToSport(type) {
  return STRAVA_TYPE_MAP[type] || "rest";
}

function parseStravaActivity(a) {
  const distanceKm = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : null;
  const durationMin = Math.round(a.moving_time / 60);
  const elevation = Math.round(a.total_elevation_gain || 0);
  const sport = stravaTypeToSport(a.type);
  let pace = null;
  if (sport === "run" && a.distance > 0) {
    const secPerKm = a.moving_time / (a.distance / 1000);
    const min = Math.floor(secPerKm / 60);
    const sec = Math.round(secPerKm % 60).toString().padStart(2, "0");
    pace = `${min}:${sec}/km`;
  } else if (sport === "bike" && a.moving_time > 0) {
    const kmh = (a.distance / 1000) / (a.moving_time / 3600);
    pace = `${kmh.toFixed(1)} km/h`;
  } else if (sport === "swim" && a.distance > 0) {
    const secPer100 = a.moving_time / (a.distance / 100);
    const min = Math.floor(secPer100 / 60);
    const sec = Math.round(secPer100 % 60).toString().padStart(2, "0");
    pace = `${min}:${sec}/100m`;
  }
  return {
    id: a.id, date: a.start_date_local?.split("T")[0] || "",
    sport, title: a.name, distance: distanceKm, duration: durationMin,
    elevation, pace, hr: Math.round(a.average_heartrate) || null,
    feel: a.perceived_exertion ? Math.min(5, Math.round(a.perceived_exertion)) : null,
  };
}

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

function formatDuration(min) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}` : `${m}min`;
}
function formatDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function today() { return new Date().toISOString().split("T")[0]; }
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7; }

function SportBadge({ sport, small }) {
  const cfg = sportConfig[sport] || sportConfig.rest;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: small ? 3 : 5,
      padding: small ? "2px 7px" : "4px 10px", background: cfg.bg, borderRadius: 20,
      fontSize: small ? 11 : 12, fontWeight: 600, color: cfg.color,
      border: `1px solid ${cfg.color}33`, letterSpacing: "0.03em"
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "16px 18px", flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 400, color: accent || "#fff", fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return (
    <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

function Stat({ icon, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 400, color: "#ccc", fontFamily: "'DM Serif Display', Georgia, serif" }}>{value}</span>
    </div>
  );
}

function SessionCard({ session, big }) {
  const cfg = sportConfig[session.sport] || sportConfig.rest;
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
      border: `1px solid ${cfg.color}33`, borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 14, padding: big ? "16px" : "12px 14px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <SportBadge sport={session.sport} small />
            {session.done && <span style={{ fontSize: 10, color: "#96CEB4", fontWeight: 700 }}>✓ FAIT</span>}
          </div>
          <div style={{ fontSize: big ? 16 : 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{session.title}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{session.detail}</div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 12 }}>
          {session.distance && <div style={{ fontSize: 16, fontWeight: 400, color: cfg.color, fontFamily: "'DM Serif Display', Georgia, serif" }}>{session.distance} km</div>}
          <div style={{ fontSize: 12, color: "#666" }}>{formatDuration(session.duration)}</div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }) {
  const cfg = sportConfig[activity.sport] || sportConfig.rest;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(255,255,255,0.02) 100%)`,
      border: `1px solid ${cfg.color}22`, borderRadius: 16, padding: "16px",
    }}>
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

function HomePage({ plan, strava }) {
  const todaySessions = plan.filter(s => s.date === today());
  const lastActivity = strava[0];
  const totalKm = strava.filter(a => a.sport === "run").reduce((a, b) => a + (b.distance || 0), 0);
  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ paddingTop: 28, paddingBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>
          Bonjour 👋
        </h1>
        <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
          {todaySessions.length > 0 ? `${todaySessions.length} séance${todaySessions.length > 1 ? "s" : ""} aujourd'hui` : "Pas de séance planifiée"}
        </div>
      </div>
      {todaySessions.length > 0 && (
        <>
          <SectionTitle>Séances du jour</SectionTitle>
          {todaySessions.map(s => <SessionCard key={s.id} session={s} big />)}
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

const navBtn = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", borderRadius: 10, width: 36, height: 36, fontSize: 20,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
};

function CalendarPage({ plan }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(today());
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const dayHasSessions = (dateStr) => plan.filter(s => s.date === dateStr);
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
        {["L","M","M","J","V","S","D"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#666", fontWeight: 700, padding: "4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 24 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const sessions = dayHasSessions(dateStr);
          const isToday = dateStr === today();
          const isSelected = dateStr === selectedDay;
          const isPast = dateStr < today();
          return (
            <div key={i} onClick={() => setSelectedDay(dateStr)} style={{
              borderRadius: 10, padding: "8px 4px", textAlign: "center", cursor: "pointer",
              background: isSelected ? "#FF6B35" : isToday ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.04)",
              border: isToday && !isSelected ? "1px solid #FF6B3555" : "1px solid transparent",
              opacity: isPast && !isToday ? 0.5 : 1, transition: "all 0.15s"
            }}>
              <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isSelected ? "#fff" : "#ccc" }}>{d}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 3, flexWrap: "wrap" }}>
                {sessions.map(s => (
                  <div key={s.id} style={{ width: 5, height: 5, borderRadius: "50%", background: isSelected ? "#fff" : sportConfig[s.sport]?.color || "#888" }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <SectionTitle>{formatDate(selectedDay)}</SectionTitle>
      {selectedSessions.length > 0
        ? selectedSessions.map(s => <SessionCard key={s.id} session={s} />)
        : <div style={{ color: "#666", fontSize: 14, fontStyle: "italic", paddingTop: 8 }}>Pas de séance planifiée</div>
      }
    </div>
  );
}

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
          <div style={{ fontSize: 14, color: "#888", marginBottom: 24, lineHeight: 1.6 }}>Synchronise automatiquement toutes tes activités — course, vélo, natation et plus encore.</div>
          <button onClick={onConnect} style={{ background: "#FC4C02", border: "none", borderRadius: 14, padding: "14px 28px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(252,76,2,0.35)", width: "100%" }}>
            Se connecter avec Strava
          </button>
        </div>
        <div style={{ marginTop: 28, opacity: 0.4 }}>
          <SectionTitle>Aperçu (données exemple)</SectionTitle>
          {MOCK_STRAVA.slice(0, 2).map(a => <ActivityCard key={a.id} activity={a} />)}
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
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: filter === s ? "#FC4C02" : "rgba(255,255,255,0.07)", color: filter === s ? "#fff" : "#999", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
            {s === "all" ? "Tout" : sportConfig[s]?.icon + " " + sportConfig[s]?.label}
          </button>
        ))}
      </div>
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>Chargement de tes activités…</div>
        </div>
      )}
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.length > 0
            ? filtered.map(a => <ActivityCard key={a.id} activity={a} />)
            : <div style={{ color: "#666", fontSize: 14, fontStyle: "italic", paddingTop: 8 }}>Aucune activité pour ce filtre</div>
          }
        </div>
      )}
    </div>
  );
}

function DashboardPage({ strava }) {
  const runKm = strava.filter(a => a.sport === "run").reduce((a, b) => a + (b.distance || 0), 0);
  const bikeKm = strava.filter(a => a.sport === "bike").reduce((a, b) => a + (b.distance || 0), 0);
  const swimKm = strava.filter(a => a.sport === "swim").reduce((a, b) => a + (b.distance || 0), 0);
  const totalTime = strava.reduce((a, b) => a + b.duration, 0);
  const loadData = [42, 38, 55, 48, 62, 58, 71];
  const days = ["L","M","M","J","V","S","D"];
  const maxLoad = Math.max(...loadData);
  const goalProgress = 68;
  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ paddingTop: 28, paddingBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: "'DM Serif Display', Georgia, serif", letterSpacing: "-0.01em" }}>Dashboard</h1>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Semaine en cours · 7 jours glissants</div>
      </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label="Course" value={`${runKm.toFixed(0)} km`} accent="#FF6B35" sub="7 jours" />
        <StatCard label="Vélo" value={`${bikeKm.toFixed(0)} km`} accent="#F5C518" sub="7 jours" />
        <StatCard label="Natation" value={`${swimKm.toFixed(1)} km`} accent="#45B7D1" sub="7 jours" />
        <StatCard label="Temps total" value={formatDuration(totalTime)} sub="7 jours" />
      </div>
      <SectionTitle>Charge d'entraînement — 7 jours</SectionTitle>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
          {loadData.map((val, i) => {
            const isToday = i === 6;
            const height = (val / maxLoad) * 100;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: isToday ? "#FF6B35" : "#666" }}>{val}</div>
                <div style={{ width: "100%", height: `${height}%`, background: isToday ? "#FF6B35" : "rgba(255,255,255,0.12)", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                <div style={{ fontSize: 9, color: isToday ? "#FF6B35" : "#555", fontWeight: isToday ? 700 : 400 }}>{days[i]}</div>
              </div>
            );
          })}
        </div>
      </div>
      <SectionTitle>Répartition des sports</SectionTitle>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        {[
          { sport: "run", val: runKm, unit: "km", total: 60 },
          { sport: "bike", val: bikeKm, unit: "km", total: 100 },
          { sport: "swim", val: swimKm, unit: "km", total: 5 },
        ].map(({ sport, val, unit, total }) => {
          const cfg = sportConfig[sport];
          const pct = Math.min((val / total) * 100, 100);
          return (
            <div key={sport} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#ccc" }}>{cfg.icon} {cfg.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{val.toFixed(0)} {unit}</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 6 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: cfg.color, borderRadius: 6 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ background: "rgba(69,183,209,0.08)", border: "1px solid rgba(69,183,209,0.2)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 24 }}>✅</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#45B7D1" }}>Forme optimale</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Charge d'entraînement équilibrée. Continue comme ça !</div>
        </div>
      </div>
    </div>
  );
}

function AIChatBubble({ strava, plan }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Salut ! Je suis ton coach IA 🏃 Je peux analyser tes activités Strava, générer ou adapter ton planning, et répondre à tes questions d'entraînement. Comment puis-je t'aider ?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const systemPrompt = `Tu es un coach sportif expert en trail, course à pied, triathlon et renforcement musculaire.
Tu analyses les données d'entraînement Strava de l'utilisateur et génères des plans personnalisés.
Réponds toujours en français, de façon concise, bienveillante et motivante.
Voici les dernières activités Strava (JSON): ${JSON.stringify(strava.slice(0, 10))}
Voici le planning actuel (JSON): ${JSON.stringify(plan)}
Objectif principal: Trail 50km en automne 2026.`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    const history = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
    history.push({ role: "user", content: userMsg });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages: history })
      });
      const data = await res.json();
      const reply = data.content?.map(c => c.text || "").join("") || "Désolé, je n'ai pas pu répondre.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erreur de connexion. Vérifie ta clé API." }]);
    }
    setLoading(false);
  };

  const quickActions = ["Génère mon plan semaine", "Analyse mes dernières sorties", "J'ai mal aux jambes, adapte ma semaine"];

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{ position: "fixed", bottom: 90, right: 20, zIndex: 1000, width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg, #FF6B35, #FF8C5A)", border: "none", cursor: "pointer", fontSize: 22, boxShadow: "0 4px 20px rgba(255,107,53,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {open ? "✕" : "🤖"}
      </button>
      {open && (
        <div style={{ position: "fixed", bottom: 155, right: 16, left: 16, zIndex: 999, background: "#1A1A2E", border: "1px solid rgba(255,107,53,0.25)", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", maxHeight: "60vh" }}>
          <div style={{ padding: "14px 16px", background: "rgba(255,107,53,0.1)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>🤖 Coach IA</div>
            <div style={{ fontSize: 11, color: "#888" }}>Propulsé par Claude</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "linear-gradient(135deg, #FF6B35, #FF8C5A)" : "rgba(255,255,255,0.07)", fontSize: 13, color: "#fff", lineHeight: 1.5 }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 4, padding: "8px 14px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6B35", animation: `bounce 0.8s ${i*0.15}s infinite alternate` }} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {messages.length <= 1 && (
            <div style={{ padding: "8px 12px", display: "flex", gap: 6, overflowX: "auto", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {quickActions.map((q, i) => (
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
          <div style={{ fontSize: 10, fontWeight: page === t.id ? 700 : 400, color: page === t.id ? "#FF6B35" : "#666", transition: "all 0.15s" }}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [plan] = useState(MOCK_PLAN);
  const [stravaToken, setStravaToken] = useState(() => localStorage.getItem("strava_access_token") || null);
  const [stravaRefresh, setStravaRefresh] = useState(() => localStorage.getItem("strava_refresh_token") || null);
  const [stravaExpires, setStravaExpires] = useState(() => localStorage.getItem("strava_expires_at") || null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [syncTime, setSyncTime] = useState(null);

  const stravaConnected = !!stravaToken;
  const strava = stravaConnected ? stravaActivities : MOCK_STRAVA;

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
    const res = await fetch("/api/strava-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: stravaRefresh })
    });
    const data = await res.json();
    if (data.access_token) { saveToken(data); return data.access_token; }
    return null;
  }, [stravaToken, stravaRefresh, stravaExpires, saveToken]);

  const loadActivities = useCallback(async (token) => {
    setStravaLoading(true);
    try {
      const validToken = token || await getValidToken();
      if (!validToken) return;
      const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=30", {
        headers: { Authorization: `Bearer ${validToken}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setStravaActivities(data.map(parseStravaActivity));
        setSyncTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (err) { console.error("Strava load error:", err); }
    setStravaLoading(false);
  }, [getValidToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    if (error) { window.history.replaceState({}, "", window.location.pathname); return; }
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      setPage("strava");
      fetch("/api/strava-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, grant_type: "authorization_code" })
      })
        .then(r => r.json())
        .then(data => { if (data.access_token) { saveToken(data); loadActivities(data.access_token); } })
        .catch(err => console.error("Token exchange error:", err));
    }
  }, [saveToken, loadActivities]);

  useEffect(() => {
    if (stravaToken) loadActivities();
  }, []);

  const handleStravaConnect = () => {
    const redirectUri = encodeURIComponent(window.location.origin);
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=${STRAVA_SCOPE}`;
    window.location.href = url;
  };

  const handleStravaDisconnect = () => {
    localStorage.removeItem("strava_access_token");
    localStorage.removeItem("strava_refresh_token");
    localStorage.removeItem("strava_expires_at");
    setStravaToken(null); setStravaRefresh(null); setStravaExpires(null);
    setStravaActivities([]);
  };

  const pages = {
    home: () => <HomePage plan={plan} strava={strava} />,
    calendar: () => <CalendarPage plan={plan} />,
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
      `}</style>
      {pages[page]?.()}
      <BottomNav page={page} setPage={setPage} />
      <AIChatBubble strava={strava} plan={plan} />
    </div>
  );
}
