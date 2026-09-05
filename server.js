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
if (!CLIENT_ID || !REDIRECT_URI) {
return res.status(500).send("Discord OAuth is not configured.");
}


const discordURL =
    "https://discord.com/oauth2/authorize" +
    "?client_id=" + encodeURIComponent(CLIENT_ID) +
    "&response_type=code" +
    "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
    "&scope=identify";

res.redirect(discordURL);


});

app.get("/callback", async (req, res) => {
const code = req.query.code;


if (!code) {
    return res.status(400).send(
        "Discord authorization code is missing."
    );
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
            }).toString()
        }
    );

    const tokenText = await tokenResponse.text();

    let tokenData;

    try {
        tokenData = JSON.parse(tokenText);
    } catch (parseError) {
        console.error(
            "Discord returned non-JSON:",
            tokenText.substring(0, 1000)
        );

        return res.status(500).send(
            "Discord returned an unexpected response. Check the Render logs."
        );
    }

    if (!tokenResponse.ok) {
        console.error(
            "Discord token error:",
            tokenData
        );

        return res.status(500).send(
            "Discord authentication failed: " +
            (tokenData.error_description || tokenData.error || "Unknown error")
        );
    }

    const userResponse = await fetch(
        "https://discord.com/api/users/@me",
        {
            headers: {
                Authorization:
                    "Bearer " + tokenData.access_token
            }
        }
    );

    const userText = await userResponse.text();

    let user;

    try {
        user = JSON.parse(userText);
    } catch (parseError) {
        console.error(
            "Discord user endpoint returned non-JSON:",
            userText.substring(0, 1000)
        );

        return res.status(500).send(
            "Discord returned an unexpected user response."
        );
    }

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


});

app.listen(PORT, () => {
console.log(
"🤖 Botzen running on port " + PORT
);
});
