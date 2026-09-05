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
return res.status(500).send(
"Discord OAuth is not configured."
);
}


const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify"
});

res.redirect(
    "https://discord.com/oauth2/authorize?" +
    params.toString()
);


});

app.get("/callback", async (req, res) => {
const code = req.query.code;


if (!code) {
    return res.status(400).send(
        "Discord authorization code is missing."
    );
}

try {
    console.log("🔐 Starting Discord OAuth token exchange...");

    const tokenResponse = await fetch(
        "https://discord.com/api/v10/oauth2/token",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "User-Agent": "Botzen/1.0"
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

    console.log(
        "Discord token HTTP status:",
        tokenResponse.status
    );

    if (tokenResponse.status === 429) {
        const retryAfter =
            tokenResponse.headers.get("retry-after");

        console.error(
            "⚠️ Discord OAuth rate limited."
        );

        console.error(
            "Retry-After:",
            retryAfter
        );

        return res.status(429).send(
            "Discord is temporarily rate-limiting Botzen. " +
            "Please wait a few minutes and try again."
        );
    }

    if (!tokenResponse.ok) {
        console.error(
            "Discord token response:",
            tokenText.substring(0, 2000)
        );

        return res.status(502).send(
            "Discord rejected the authentication request. " +
            "HTTP " + tokenResponse.status
        );
    }

    let tokenData;

    try {
        tokenData = JSON.parse(tokenText);
    } catch (error) {
        console.error(
            "Discord token response was not JSON:",
            tokenText.substring(0, 2000)
        );

        return res.status(502).send(
            "Discord returned an invalid authentication response."
        );
    }

    if (!tokenData.access_token) {
        console.error(
            "No access token returned:",
            tokenData
        );

        return res.status(502).send(
            "Discord did not provide an access token."
        );
    }

    console.log(
        "✅ Discord access token received."
    );

    const userResponse = await fetch(
        "https://discord.com/api/v10/users/@me",
        {
            method: "GET",

            headers: {
                "Authorization":
                    "Bearer " + tokenData.access_token,
                "Accept": "application/json",
                "User-Agent": "Botzen/1.0"
            }
        }
    );

    const userText = await userResponse.text();

    console.log(
        "Discord user HTTP status:",
        userResponse.status
    );

    if (userResponse.status === 429) {
        console.error(
            "⚠️ Discord user endpoint rate limited."
        );

        return res.status(429).send(
            "Discord is temporarily rate-limiting Botzen. " +
            "Please wait a few minutes and try again."
        );
    }

    if (!userResponse.ok) {
        console.error(
            "Discord user response:",
            userText.substring(0, 2000)
        );

        return res.status(502).send(
            "Discord could not provide your account information."
        );
    }

    let user;

    try {
        user = JSON.parse(userText);
    } catch (error) {
        console.error(
            "Discord user response was not JSON:",
            userText.substring(0, 2000)
        );

        return res.status(502).send(
            "Discord returned an invalid user response."
        );
    }

    console.log(
        "✅ Botzen login:",
        user.username,
        user.id
    );

    res.redirect("/dashboard.html");

} catch (error) {
    console.error(
        "❌ OAuth connection error:",
        error
    );

    res.status(500).send(
        "Botzen could not connect to Discord."
    );
}


});

app.listen(PORT, () => {
console.log(
"🤖 Botzen running on port " + PORT
);
});
