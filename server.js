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

    // Temporary authentication proof
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Botzen — Dashboard</title>
        </head>

        <body style="
            margin: 0;
            background: #111214;
            color: white;
            font-family: Arial, Helvetica, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        ">

            <div style="
                text-align: center;
                padding: 40px;
                background: #1e1f22;
                border-radius: 18px;
                max-width: 500px;
                width: calc(100% - 40px);
            ">

                <h1>Welcome to Botzen 👋</h1>

                <p style="color: #b5bac1;">
                    Discord authentication successful!
                </p>

                <p>
                    Welcome,
                    <strong>${escapeHTML(
                        user.global_name || user.username || "Discord User"
                    )}</strong>
                </p>

                <p style="color: #72767d; font-size: 13px;">
                    Discord ID: ${escapeHTML(user.id)}
                </p>

                <a
                    href="/dashboard.html"
                    style="
                        display: inline-block;
                        margin-top: 20px;
                        padding: 12px 20px;
                        border-radius: 8px;
                        background: #5865f2;
                        color: white;
                        text-decoration: none;
                        font-weight: bold;
                    "
                >
                    Enter Dashboard
                </a>

            </div>

        </body>
        </html>
    `);

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
