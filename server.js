const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const MONGODB_URI = process.env.MONGODB_URI;

/* =========================
EXPRESS
========================= */

app.use(express.json());

app.use(express.urlencoded({
extended: true
}));

app.use(express.static(__dirname));

/* =========================
MONGODB
========================= */

let mongoClient = null;
let database = null;

async function connectDatabase() {

```
if (!MONGODB_URI) {

    throw new Error(
        "MONGODB_URI environment variable is missing."
    );

}

mongoClient = new MongoClient(
    MONGODB_URI
);

await mongoClient.connect();

database =
    mongoClient.db("Botzen");

console.log(
    "✅ Connected to MongoDB."
);

console.log(
    "📦 Database: Botzen"
);

await database
    .collection("users")
    .createIndex(
        {
            discordId: 1
        },
        {
            unique: true,
            sparse: true
        }
    );

await database
    .collection("users")
    .createIndex(
        {
            username: 1
        },
        {
            unique: true,
            sparse: true
        }
    );

await database
    .collection("bots")
    .createIndex({
        ownerId: 1
    });

await database
    .collection("sessions")
    .createIndex(
        {
            sessionId: 1
        },
        {
            unique: true
        }
    );

console.log(
    "✅ MongoDB indexes ready."
);
```

}

/* =========================
SESSION HELPERS
========================= */

function createSessionId() {

```
return crypto
    .randomBytes(32)
    .toString("hex");
```

}

async function createSession(userId) {

```
const sessionId =
    createSessionId();

await database
    .collection("sessions")
    .insertOne({

        sessionId: sessionId,

        userId: userId,

        createdAt: new Date(),

        lastUsedAt: new Date()

    });

return sessionId;
```

}

function setSessionCookie(res, sessionId) {

```
res.setHeader(
    "Set-Cookie",

    "botzen_session=" +
    encodeURIComponent(sessionId) +
    "; Path=/; HttpOnly; Secure; SameSite=Lax"
);
```

}

function getSessionId(req) {

```
const cookieHeader =
    req.headers.cookie || "";

const cookies =
    cookieHeader
        .split(";")
        .map(function(item) {

            return item.trim();

        });

for (const cookie of cookies) {

    if (
        cookie.startsWith(
            "botzen_session="
        )
    ) {

        return decodeURIComponent(
            cookie.substring(
                "botzen_session=".length
            )
        );

    }

}

return null;
```

}

async function getCurrentUser(req) {

```
if (!database) {

    return null;

}

const sessionId =
    getSessionId(req);

if (!sessionId) {

    return null;

}

const session =
    await database
        .collection("sessions")
        .findOne({
            sessionId: sessionId
        });

if (!session) {

    return null;

}

await database
    .collection("sessions")
    .updateOne(
        {
            sessionId: sessionId
        },
        {
            $set: {
                lastUsedAt: new Date()
            }
        }
    );

return database
    .collection("users")
    .findOne({
        _id: session.userId
    });
```

}

/* =========================
HOME
========================= */

app.get("/", function(req, res) {

```
res.sendFile(
    path.join(
        __dirname,
        "index.html"
    )
);
```

});

/* =========================
DATABASE TEST
========================= */

app.get(
"/api/health",
async function(req, res) {

```
    try {

        if (!database) {

            return res.status(503).json({

                ok: false,

                database: false,

                message:
                    "Database is not connected."

            });

        }

        await database.command({
            ping: 1
        });

        res.json({

            ok: true,

            database: true,

            message:
                "Botzen is connected to MongoDB."

        });

    } catch (error) {

        console.error(
            "MongoDB health error:",
            error
        );

        res.status(500).json({

            ok: false,

            database: false,

            message:
                "MongoDB connection failed."

        });

    }

}
```

);

/* =========================
CURRENT USER
========================= */

app.get(
"/api/me",
async function(req, res) {

```
    try {

        const user =
            await getCurrentUser(req);

        if (!user) {

            return res.status(401).json({

                authenticated: false

            });

        }

        res.json({

            authenticated: true,

            user: {

                id: user._id,

                username:
                    user.username || null,

                displayName:
                    user.displayName || null,

                discordId:
                    user.discordId || null,

                discordUsername:
                    user.discordUsername || null,

                avatar:
                    user.avatar || null,

                role:
                    user.role || "user"

            }

        });

    } catch (error) {

        console.error(
            "Current user error:",
            error
        );

        res.status(500).json({

            authenticated: false,

            message:
                "Could not load account."

        });

    }

}
```

);

/* =========================
DISCORD OAUTH
========================= */

app.get(
"/auth/discord",
function(req, res) {

```
    if (
        !CLIENT_ID ||
        !REDIRECT_URI
    ) {

        return res.status(500).send(
            "Discord OAuth is not configured."
        );

    }

    const params =
        new URLSearchParams({

            client_id:
                CLIENT_ID,

            response_type:
                "code",

            redirect_uri:
                REDIRECT_URI,

            scope:
                "identify"

        });

    res.redirect(
        "https://discord.com/oauth2/authorize?" +
        params.toString()
    );

}
```

);

/* =========================
DISCORD CALLBACK
========================= */

app.get(
"/callback",
async function(req, res) {

```
    const code =
        req.query.code;

    if (!code) {

        return res.status(400).send(
            "Discord authorization code is missing."
        );

    }

    if (
        !CLIENT_ID ||
        !CLIENT_SECRET ||
        !REDIRECT_URI
    ) {

        return res.status(500).send(
            "Discord OAuth is not configured."
        );

    }

    try {

        console.log(
            "🔐 Starting Discord OAuth token exchange..."
        );


        const tokenResponse =
            await fetch(
                "https://discord.com/api/v10/oauth2/token",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/x-www-form-urlencoded",

                        "Accept":
                            "application/json",

                        "User-Agent":
                            "Botzen/1.0"

                    },

                    body:
                        new URLSearchParams({

                            client_id:
                                CLIENT_ID,

                            client_secret:
                                CLIENT_SECRET,

                            grant_type:
                                "authorization_code",

                            code:
                                code,

                            redirect_uri:
                                REDIRECT_URI

                        }).toString()

                }
            );


        const tokenText =
            await tokenResponse.text();


        console.log(
            "Discord token HTTP status:",
            tokenResponse.status
        );


        if (
            tokenResponse.status ===
            429
        ) {

            const retryAfter =
                tokenResponse.headers.get(
                    "retry-after"
                );

            console.error(
                "⚠️ Discord OAuth rate limited."
            );

            console.error(
                "Retry-After:",
                retryAfter
            );

            return res.status(429).send(
                "Discord is temporarily rate-limiting Botzen. " +
                "Please try again later."
            );

        }


        if (!tokenResponse.ok) {

            console.error(
                "Discord token response:",
                tokenText.substring(
                    0,
                    2000
                )
            );

            return res.status(502).send(
                "Discord rejected the authentication request. " +
                "HTTP " +
                tokenResponse.status
            );

        }


        let tokenData;


        try {

            tokenData =
                JSON.parse(
                    tokenText
                );

        } catch (error) {

            console.error(
                "Discord token response was not JSON."
            );

            return res.status(502).send(
                "Discord returned an invalid authentication response."
            );

        }


        if (
            !tokenData.access_token
        ) {

            return res.status(502).send(
                "Discord did not provide an access token."
            );

        }


        console.log(
            "✅ Discord access token received."
        );


        const userResponse =
            await fetch(
                "https://discord.com/api/v10/users/@me",
                {

                    method: "GET",

                    headers: {

                        "Authorization":
                            "Bearer " +
                            tokenData.access_token,

                        "Accept":
                            "application/json",

                        "User-Agent":
                            "Botzen/1.0"

                    }

                }
            );


        const userText =
            await userResponse.text();


        console.log(
            "Discord user HTTP status:",
            userResponse.status
        );


        if (
            userResponse.status ===
            429
        ) {

            return res.status(429).send(
                "Discord is temporarily rate-limiting Botzen. " +
                "Please try again later."
            );

        }


        if (!userResponse.ok) {

            console.error(
                "Discord user response:",
                userText.substring(
                    0,
                    2000
                )
            );

            return res.status(502).send(
                "Discord could not provide your account information."
            );

        }


        let user;


        try {

            user =
                JSON.parse(
                    userText
                );

        } catch (error) {

            return res.status(502).send(
                "Discord returned an invalid user response."
            );

        }


        console.log(
            "✅ Botzen Discord login:",
            user.username,
            user.id
        );


        /* =========================
           SAVE USER
        ========================= */

        const users =
            database.collection(
                "users"
            );


        let existingUser =
            await users.findOne({

                discordId:
                    user.id

            });


        if (!existingUser) {

            const newUser = {

                discordId:
                    user.id,

                discordUsername:
                    user.username,

                displayName:
                    user.global_name ||
                    user.username,

                avatar:
                    user.avatar
                        ? "https://cdn.discordapp.com/avatars/" +
                          user.id +
                          "/" +
                          user.avatar +
                          ".png?size=256"
                        : null,

                role:
                    "user",

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            };


            const result =
                await users.insertOne(
                    newUser
                );


            existingUser =
                await users.findOne({
                    _id: result.insertedId
                });

        } else {

            await users.updateOne(

                {
                    _id:
                        existingUser._id
                },

                {
                    $set: {

                        discordUsername:
                            user.username,

                        displayName:
                            user.global_name ||
                            user.username,

                        avatar:
                            user.avatar
                                ? "https://cdn.discordapp.com/avatars/" +
                                  user.id +
                                  "/" +
                                  user.avatar +
                                  ".png?size=256"
                                : null,

                        updatedAt:
                            new Date()

                    }

                }

            );


            existingUser =
                await users.findOne({
                    _id:
                        existingUser._id
                });

        }


        /* =========================
           CREATE SESSION
        ========================= */

        const sessionId =
            await createSession(
                existingUser._id
            );


        setSessionCookie(
            res,
            sessionId
        );


        console.log(
            "✅ Botzen session created."
        );


        res.redirect(
            "/dashboard.html"
        );


    } catch (error) {

        console.error(
            "❌ OAuth connection error:",
            error
        );

        res.status(500).send(
            "Botzen could not connect to Discord."
        );

    }

}
```

);

/* =========================
BOT LIST
========================= */

app.get(
"/api/bots",
async function(req, res) {

```
    try {

        const user =
            await getCurrentUser(req);

        if (!user) {

            return res.status(401).json({

                authenticated: false

            });

        }


        const botList =
            await database
                .collection("bots")
                .find({
                    ownerId:
                        user._id
                })
                .sort({
                    createdAt: -1
                })
                .toArray();


        res.json({

            bots:
                botList.map(function(bot) {

                    return {

                        id:
                            bot._id,

                        botId:
                            bot.botId,

                        name:
                            bot.name,

                        username:
                            bot.username,

                        avatar:
                            bot.avatar,

                        online:
                            bot.online === true,

                        locked:
                            bot.locked === true

                    };

                })

        });

    } catch (error) {

        console.error(
            "Bot list error:",
            error
        );

        res.status(500).json({

            message:
                "Could not load bots."

        });

    }

}
```

);

/* =========================
LOGOUT
========================= */

app.post(
"/api/logout",
async function(req, res) {

```
    try {

        const sessionId =
            getSessionId(req);

        if (sessionId) {

            await database
                .collection("sessions")
                .deleteOne({

                    sessionId:
                        sessionId

                });

        }


        res.setHeader(
            "Set-Cookie",
            "botzen_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        );


        res.json({

            success: true

        });

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        res.status(500).json({

            success: false

        });

    }

}
```

);

/* =========================
START SERVER
========================= */

async function startServer() {

```
try {

    await connectDatabase();


    app.listen(
        PORT,
        function() {

            console.log(
                "🤖 Botzen running on port " +
                PORT
            );

        }
    );

} catch (error) {

    console.error(
        "❌ Could not start Botzen:",
        error
    );

    process.exit(1);

}
```

}

startServer();
