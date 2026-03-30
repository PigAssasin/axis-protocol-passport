require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;

app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'ritual-secret-key-2024'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

app.use(express.static(path.join(__dirname, 'public')));

// Check if Discord OAuth is configured
app.get('/api/config', (req, res) => {
  res.json({ configured: !!(CLIENT_ID && CLIENT_SECRET) });
});

// Step 1: Redirect to Discord
app.get('/auth/discord', (req, res) => {
  if (!CLIENT_ID) return res.redirect('/?error=not_configured');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Step 2: Handle callback
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=denied');

  try {
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const token = tokenRes.data.access_token;

    const [userRes, guildsRes] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: [] }))
    ]);

    let guildMember = null;
    if (TARGET_GUILD_ID) {
      try {
        const gmRes = await axios.get(`https://discord.com/api/users/@me/guilds/${TARGET_GUILD_ID}/member`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        guildMember = gmRes.data;
      } catch (e) {
        console.log("Could not fetch specific guild member data.");
      }
    }

    const u = userRes.data;
    req.session.user = {
      id: u.id,
      username: u.global_name || u.username,
      tag: u.discriminator !== '0' ? `${u.username}#${u.discriminator}` : `@${u.username}`,
      avatar: u.avatar,
      banner: u.banner,
      accent_color: u.accent_color,
      premium_type: u.premium_type || 0,
      public_flags: u.public_flags || 0,
      guild_count: guildsRes.data.length,
      guild_member: guildMember
    };

    res.redirect('/?connected=true');
  } catch (err) {
    console.error('Auth error:', err.response?.data || err.message);
    res.redirect('/?error=failed');
  }
});

// Get current user data
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthenticated' });
  res.json(req.session.user);
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Axis Robotics Generator → http://localhost:${PORT}\n`);
    if (!CLIENT_ID) console.log('⚠  Copy .env.example → .env and add your Discord credentials\n');
  });
}

// Export the Express API for Serverless environments like Vercel
module.exports = app;
