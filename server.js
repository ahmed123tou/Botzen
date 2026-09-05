const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
console.warn("⚠️ Discord OAuth environment variables are missing.");
}

app.use(express.static(__dirname));

app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/auth/discord", (req, res) => {
const discordURL =
"https://discord.com/oauth2/authorize" +
"?client_id=" + encodeURIComponent(CLIENT_ID) +
"&response_type=code" +
"&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
"&scope=identify";

```
res.redirect(discordURL);
```

});

app.get("/callback", async (req, res) => {
const code = req.query.code;

```
if (!code) {
    return res.status(400).send("Discord authorization code is missing.");
}

try {
    const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: REDIRECT_URI
            })
        }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error("Discord token error:", tokenData);
        return res.status(500).send("Discord authentication failed.");
    }

    const userResponse = await fetch(
        "https://discord.com/api/users/@me",
        {
            headers: {
                Authorization: "Bearer " + tokenData.access_token
            }
        }
    );

    const user = await userResponse.json();

    if (!userResponse.ok) {
        console.error("Discord user error:", user);
        return res.status(500).send(
            "Could not retrieve your Discord account."
        );
    }

    console.log("Botzen user:", user);

    const avatarURL = user.avatar
        ? "https://cdn.discordapp.com/avatars/" +
          user.id +
          "/" +
          user.avatar +
          ".png"
        : "";

    const username = escapeHTML(
        user.global_name || user.username || "Discord User"
    );

    const userID = escapeHTML(user.id);

    res.send(`
```

<!DOCTYPE html>

<html lang="en">

<head>
    <meta charset="UTF-8">

```
<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>Botzen — Dashboard</title>

<style>

    * {
        box-sizing: border-box;
    }

    body {
        margin: 0;
        min-height: 100vh;

        font-family: Arial, Helvetica, sans-serif;

        background: #111214;
        color: white;
    }

    .sidebar {
        position: fixed;

        width: 250px;
        height: 100vh;

        padding: 25px 15px;

        background: #18191c;

        border-right: 1px solid rgba(255,255,255,0.05);
    }

    .brand {
        font-size: 24px;
        font-weight: 800;

        margin-bottom: 30px;

        padding-left: 10px;
    }

    .section-title {
        color: #72767d;

        font-size: 11px;
        font-weight: 800;

        margin: 20px 10px 8px;

        letter-spacing: 1px;
    }

    .nav-item {
        padding: 11px 12px;

        border-radius: 7px;

        color: #b5bac1;

        margin-bottom: 4px;

        cursor: pointer;
    }

    .nav-item:hover {
        background: #2b2d31;
        color: white;
    }

    .content {
        margin-left: 250px;
        padding: 45px;
    }

    .welcome {
        font-size: 32px;
        font-weight: 800;
        margin-bottom: 10px;
    }

    .description {
        color: #b5bac1;
        margin-bottom: 30px;
    }

    .user-card {
        display: flex;
        align-items: center;

        gap: 15px;

        padding: 20px;

        max-width: 600px;

        background: #1e1f22;

        border-radius: 12px;
    }

    .avatar {
        width: 55px;
        height: 55px;

        border-radius: 50%;

        object-fit: cover;
    }

    .username {
        font-size: 18px;
        font-weight: 700;
    }

    .id {
        color: #72767d;
        font-size: 13px;
        margin-top: 4px;
    }

    @media (max-width: 700px) {

        .sidebar {
            width: 210px;
        }

        .content {
            margin-left: 210px;
            padding: 25px;
        }

        .welcome {
            font-size: 26px;
        }

    }

</style>
```

</head>

<body>

```
<aside class="sidebar">

    <div class="brand">
        🤖 Botzen
    </div>

    <div class="section-title">
        🌐 INFORMATION
    </div>

    <div class="nav-item">
        🏠│Home
    </div>

    <div class="nav-item">
        📜│Announcements
    </div>

    <div class="section-title">
        🤖 BOT DIRECTORY
    </div>

    <div class="nav-item">
        🤖│My Bots
    </div>

    <div class="nav-item">
        ➕│Add Bot
    </div>

    <div class="section-title">
        🔗 CONNECTIONS
    </div>

    <div class="nav-item">
        ✉️│Invite
    </div>

</aside>

<main class="content">

    <div class="welcome">
        Welcome to Botzen 👋
    </div>

    <div class="description">
        Your Discord account is connected successfully.
    </div>

    <div class="user-card">

        ${
            avatarURL
                ? `<img
                    class="avatar"
                    src="${avatarURL}"
                    alt="Discord Avatar"
                  >`
                : `<div class="avatar"></div>`
        }

        <div>

            <div class="username">
                ${username}
            </div>

            <div class="id">
                Discord ID: ${userID}
            </div>

        </div>

    </div>

</main>
```

</body>

</html>
        `);

```
} catch (error) {

    console.error("OAuth error:", error);

    res.status(500).send(
        "Something went wrong while connecting to Discord."
    );
}
```

});

function escapeHTML(value) {
return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

app.listen(PORT, () => {
console.log("🤖 Botzen running on port " + PORT);
});
