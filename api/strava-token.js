export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, grant_type, refresh_token } = req.body;

  try {
    const body = {
      client_id: process.env.VITE_STRAVA_CLIENT_ID,
      client_secret: process.env.VITE_STRAVA_CLIENT_SECRET,
      grant_type: grant_type || "authorization_code",
    };

    if (grant_type === "authorization_code" || !grant_type) body.code = code;
    if (grant_type === "refresh_token") body.refresh_token = refresh_token;

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.message || "Strava error" });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
