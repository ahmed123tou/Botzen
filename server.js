const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

let mongoClient = null;
let database = null;

/* =========================
EXPRESS
========================= */

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({
extended: true
}));

app.use(express.static(__dirname));

/* =========================
DATABASE
========================= */

async function connectDatabase() {

```
if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing.");
}

mongoClient = new MongoClient(MONGODB_URI);

await mongoClient.connect();

database = mongoClient.db("Botzen");

console.log("✅ Connected to MongoDB.");
console.log("📦 Database: Botzen");

await database.collection("users").createIndex(
    { discordId: 1 },
    {
        unique: true,
        sparse: true
    }
);

await database.collection("users").createIndex(
    { username: 1 },
    {
        unique: true,
        sparse: true
    }
);

await database.collection("bots").createIndex({
    ownerId: 1
});

await database.collection("bots").createIndex(
    { botKey: 1 },
    {
        unique: true,
        sparse: true
    }
);

await database.collection("sessions").createIndex(
    { sessionId: 1 },
    {
        unique: true
    }
);

await database.collection("announcements").createIndex({
    createdAt: -1
});

console.log("✅ MongoDB indexes ready.");
```

}

/* =========================
SESSION SYSTEM
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
const sessionId = createSessionId();

await database.collection("sessions").insertOne({
    sessionId,
    userId,
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
const cookieHeader = req.headers.cookie || "";

const cookies = cookieHeader
    .split(";")
    .map(function(item) {
        return item.trim();
    });

for (const cookie of cookies) {

    if (cookie.startsWith("botzen_session=")) {

        return decodeURIComponent(
            cookie.substring("botzen_session=".length)
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

const sessionId = getSessionId(req);

if (!sessionId) {
    return null;
}

const session = await database
    .collection("sessions")
    .findOne({
        sessionId
    });

if (!session) {
    return null;
}

await database
    .collection("sessions")
    .updateOne(
        {
            sessionId
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
    path.join(__dirname, "index.html")
);
```

});

/* =========================
HEALTH
========================= */

app.get("/api/health", async function(req, res) {

```
try {

    await database.command({
        ping: 1
    });

    res.json({
        ok: true,
        database: true,
        message: "Botzen is online and MongoDB is connected."
    });

} catch (error) {

    console.error(error);

    res.status(500).json({
        ok: false,
        database: false
    });
}
```

});

/* =========================
CURRENT ACCOUNT
========================= */

app.get("/api/me", async function(req, res) {

```
try {

    const user = await getCurrentUser(req);

    if (!user) {

        return res.status(401).json({
            authenticated: false
        });
    }

    res.json({
        authenticated: true,

        user: {
            id: user._id.toString(),
            username: user.username || null,
            displayName: user.displayName || null,
            discordId: user.discordId || null,
            discordUsername: user.discordUsername || null,
            avatar: user.avatar || null,
            role: user.role || "user"
        }
    });

} catch (error) {

    console.error("ME error:", error);

    res.status(500).json({
        authenticated: false,
        message: "Could not load account."
    });
}
```

});

/* =========================
DISCORD OAUTH
========================= */

app.get("/auth/discord", function(req, res) {

```
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
```

});

/* =========================
DISCORD CALLBACK
========================= */

app.get("/callback", async function(req, res) {

```
const code = req.query.code;

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

    const tokenResponse = await fetch(
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

            body: new URLSearchParams({

                client_id: CLIENT_ID,

                client_secret: CLIENT_SECRET,

                grant_type:
                    "authorization_code",

                code,

                redirect_uri:
                    REDIRECT_URI

            }).toString()
        }
    );

    const tokenText =
        await tokenResponse.text();

    if (tokenResponse.status === 429) {

        return res.status(429).send(
            "Discord is temporarily rate-limiting Botzen. Please try again later."
        );
    }

    if (!tokenResponse.ok) {

        console.error(
            "Discord OAuth error:",
            tokenText
        );

        return res.status(502).send(
            "Discord rejected the authentication request."
        );
    }

    const tokenData =
        JSON.parse(tokenText);

    if (!tokenData.access_token) {

        return res.status(502).send(
            "Discord did not provide an access token."
        );
    }


    const userResponse = await fetch(
        "https://discord.com/api/v10/users/@me",
        {
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

    if (!userResponse.ok) {

        console.error(
            "Discord user error:",
            userText
        );

        return res.status(502).send(
            "Discord could not provide your account information."
        );
    }

    const discordUser =
        JSON.parse(userText);


    const users =
        database.collection("users");

    let existingUser =
        await users.findOne({
            discordId:
                discordUser.id
        });


    if (!existingUser) {

        const newUser = {

            discordId:
                discordUser.id,

            discordUsername:
                discordUser.username,

            displayName:
                discordUser.global_name ||
                discordUser.username,

            avatar:
                discordUser.avatar
                    ? "https://cdn.discordapp.com/avatars/" +
                      discordUser.id +
                      "/" +
                      discordUser.avatar +
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
                _id:
                    result.insertedId
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
                        discordUser.username,

                    displayName:
                        discordUser.global_name ||
                        discordUser.username,

                    avatar:
                        discordUser.avatar
                            ? "https://cdn.discordapp.com/avatars/" +
                              discordUser.id +
                              "/" +
                              discordUser.avatar +
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


    const sessionId =
        await createSession(
            existingUser._id
        );

    setSessionCookie(
        res,
        sessionId
    );

    res.redirect(
        "/dashboard.html"
    );

} catch (error) {

    console.error(
        "OAuth connection error:",
        error
    );

    res.status(500).send(
        "Botzen could not connect to Discord."
    );
}
```

});

/* =========================
ANNOUNCEMENTS
========================= */

/*
PUBLIC:
Everyone can read announcements.
*/

app.get(
"/api/announcements",
async function(req, res) {

```
    try {

        const announcements =
            await database
                .collection("announcements")
                .find({})
                .sort({
                    createdAt: -1
                })
                .limit(50)
                .toArray();

        res.json({
            announcements
        });

    } catch (error) {

        console.error(
            "Announcement load error:",
            error
        );

        res.status(500).json({
            message:
                "Could not load announcements."
        });
    }
}
```

);

/*
ADMIN:
Admin key must be supplied EVERY TIME.
*/

app.post(
"/api/announcements",
async function(req, res) {

```
    try {

        const user =
            await getCurrentUser(req);

        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "You must be logged in."
            });
        }


        const {
            adminKey,
            title,
            message
        } = req.body;


        if (!ADMIN_SECRET) {

            return res.status(500).json({
                success: false,
                message:
                    "ADMIN_SECRET is not configured on the server."
            });
        }


        if (
            !adminKey ||
            adminKey !== ADMIN_SECRET
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Invalid admin key."
            });
        }


        if (
            !title ||
            !message
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Title and message are required."
            });
        }


        if (
            title.length > 150 ||
            message.length > 5000
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Announcement is too long."
            });
        }


        const announcement = {

            title:
                title.trim(),

            message:
                message.trim(),

            author: {

                id:
                    "1515345578882629832",

                displayName:
                    "𝑨𝒉𝒎𝒆𝒅",

                username:
                    "ahmed123tou",

                avatar:
                    "https://files.catbox.moe/c0eqba.png"
            },

            createdAt:
                new Date()
        };


        await database
            .collection("announcements")
            .insertOne(
                announcement
            );


        res.json({

            success: true,

            message:
                "Announcement published successfully."
        });

    } catch (error) {

        console.error(
            "Announcement creation error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Could not publish announcement."
        });
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


        const bots =
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
                bots.map(function(bot) {

                    return {

                        id:
                            bot._id.toString(),

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
                            bot.locked === true,

                        botKey:
                            bot.botKey
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
ADD BOT
========================= */

app.post(
"/api/bots/add",
async function(req, res) {

```
    try {

        const user =
            await getCurrentUser(req);

        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "You must be logged in."
            });
        }


        const {
            token,
            tutorialComplete
        } = req.body;


        if (!tutorialComplete) {

            return res.status(400).json({
                success: false,
                message:
                    "You must complete every tutorial step first."
            });
        }


        if (!token || token.length < 20) {

            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid Discord bot token."
            });
        }


        /*
           Token is sent directly to Discord.
           It is NEVER returned to the browser.
        */

        const botResponse =
            await fetch(
                "https://discord.com/api/v10/users/@me",
                {
                    headers: {
                        "Authorization":
                            "Bot " + token,

                        "Accept":
                            "application/json",

                        "User-Agent":
                            "Botzen/1.0"
                    }
                }
            );


        const botText =
            await botResponse.text();


        if (!botResponse.ok) {

            return res.status(400).json({
                success: false,
                message:
                    "Discord rejected this bot token."
            });
        }


        const botUser =
            JSON.parse(botText);


        if (!botUser.bot) {

            return res.status(400).json({
                success: false,
                message:
                    "That Discord account is not a bot."
            });
        }


        const existing =
            await database
                .collection("bots")
                .findOne({

                    ownerId:
                        user._id,

                    botId:
                        botUser.id
                });


        if (existing) {

            return res.status(409).json({
                success: false,
                message:
                    "You already added this bot."
            });
        }


        const botKey =
            "BZ-" +
            crypto
                .randomBytes(12)
                .toString("hex");


        const avatar =
            botUser.avatar
                ? "https://cdn.discordapp.com/avatars/" +
                  botUser.id +
                  "/" +
                  botUser.avatar +
                  ".png?size=256"
                : null;


        /*
           For now the token is stored server-side.
           It is never placed in frontend storage.
        */

        await database
            .collection("bots")
            .insertOne({

                ownerId:
                    user._id,

                botId:
                    botUser.id,

                name:
                    botUser.global_name ||
                    botUser.username,

                username:
                    botUser.username,

                avatar,

                botKey,

                token,

                online:
                    false,

                locked:
                    false,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()
            });


        res.json({

            success: true,

            bot: {

                botId:
                    botUser.id,

                name:
                    botUser.global_name ||
                    botUser.username,

                username:
                    botUser.username,

                avatar,

                botKey
            }
        });


    } catch (error) {

        console.error(
            "Add bot error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Could not add bot."
        });
    }
}
```

);

/* =========================
LOCK / UNLOCK BOT
========================= */

app.post(
"/api/bots/:id/lock",
async function(req, res) {

```
    try {

        const user =
            await getCurrentUser(req);

        if (!user) {

            return res.status(401).json({
                success: false
            });
        }


        if (
            !ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid bot."
            });
        }


        const bot =
            await database
                .collection("bots")
                .findOne({

                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    ownerId:
                        user._id
                });


        if (!bot) {

            return res.status(404).json({
                success: false,
                message:
                    "Bot not found."
            });
        }


        const locked =
            bot.locked !== true;


        await database
            .collection("bots")
            .updateOne(
                {
                    _id:
                        bot._id,

                    ownerId:
                        user._id
                },
                {
                    $set: {
                        locked,
                        updatedAt:
                            new Date()
                    }
                }
            );


        res.json({

            success: true,

            locked
        });


    } catch (error) {

        console.error(
            "Bot lock error:",
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
INVITE BOT
========================= */

app.get(
"/api/bots/:id/invite",
async function(req, res) {

```
    try {

        const user =
            await getCurrentUser(req);

        if (!user) {

            return res.status(401).send(
                "You must be logged in."
            );
        }


        if (
            !ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).send(
                "Invalid bot."
            );
        }


        const bot =
            await database
                .collection("bots")
                .findOne({

                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    ownerId:
                        user._id
                });


        if (!bot) {

            return res.status(404).send(
                "Bot not found."
            );
        }


        const invite =
            "https://discord.com/oauth2/authorize" +
            "?client_id=" +
            encodeURIComponent(bot.botId) +
            "&permissions=0" +
            "&scope=bot%20applications.commands";


        res.redirect(invite);


    } catch (error) {

        console.error(
            "Invite error:",
            error
        );

        res.status(500).send(
            "Could not create invite."
        );
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
START
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
