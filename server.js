const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// Check configuration
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
console.warn("⚠️ Discord OAuth environment variables are missing.");
}

// Serve website files
app.use(express.static(__dirname));

// Home page
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "index.html"));
});

// Discord OAuth
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

// Discord OAuth callback
app.get("/callback", async (req, res) => {
const code = req.query.code;

```
if (!code) {
    return res.status(400).send(
        "Discord authorization code is missing."
    );
}

try {
    // Exchange authorization code for access token
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
        console.error(
            "Discord token error:",
            tokenData
        );

        return res.status(500).send(
            "Discord authentication failed."
        );
    }

    // Get Discord user
    const userResponse = await fetch(
        "https://discord.com/api/users/@me",
        {
            headers: {
                Authorization:
                    "Bearer " + tokenData.access_token
            }
        }
    );

    const user = await userResponse.json();

    if (!userResponse.ok) {
        console.error(
            "Discord user error:",
            user
        );

        return res.status(500).send(
            "Could not retrieve your Discord account."
        );
    }

    console.log(
        "Botzen user:",
        user.username,
        user.id
    );

    // OAuth succeeded.
    // For now, send the user to the dashboard.
    res.redirect("/dashboard.html");

} catch (error) {

    console.error(
        "OAuth error:",
        error
    );

    res.status(500).send(
        "Something went wrong while connecting to Discord."
    );
}
```

});

// Start server
app.listen(PORT, () => {
console.log(
"🤖 Botzen running on port " + PORT
);
});
