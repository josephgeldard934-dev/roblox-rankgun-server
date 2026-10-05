const http = require("http");

const PORT = process.env.PORT || 3000;

const RANKGUN_API_KEY = process.env.RANKGUN_API_KEY;
const ROBLOX_SECRET = process.env.ROBLOX_SECRET;

const RANKGUN_URL = "https://api.rankgun.works";

function send(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
}

async function rankGun(endpoint, body) {
    if (!RANKGUN_API_KEY) {
        throw new Error("RANKGUN_API_KEY is not configured");
    }

    const response = await fetch(`${RANKGUN_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": RANKGUN_API_KEY
        },
        body: JSON.stringify(body)
    });

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = { message: text };
    }

    if (!response.ok) {
        throw new Error(data.message || "RankGun request failed");
    }

    return data;
}

function authorized(req) {
    return (
        ROBLOX_SECRET &&
        req.headers["x-roblox-secret"] === ROBLOX_SECRET
    );
}

const server = http.createServer(async (req, res) => {

    // Test the server
    if (req.method === "GET" && req.url === "/") {
        return send(res, 200, {
            success: true,
            message: "Roblox RankGun server is online!"
        });
    }

    // All ranking requests require the secret
    if (!authorized(req)) {
        return send(res, 401, {
            success: false,
            message: "Unauthorized"
        });
    }

    if (
        req.method !== "POST" ||
        !["/promote", "/demote", "/setrank"].includes(req.url)
    ) {
        return send(res, 404, {
            success: false,
            message: "Not found"
        });
    }

    try {
        const body = await readBody(req);

        const userId = Number(body.userId);

        if (!userId) {
            return send(res, 400, {
                success: false,
                message: "Missing userId"
            });
        }

        let endpoint;
        let requestBody;

        if (req.url === "/promote") {
            endpoint = "/api/roblox/promote";
            requestBody = {
                userId: userId
            };
        }

        if (req.url === "/demote") {
            endpoint = "/api/roblox/demote";
            requestBody = {
                userId: userId
            };
        }

        if (req.url === "/setrank") {
            const rankId = Number(body.rankId);

            if (!rankId) {
                return send(res, 400, {
                    success: false,
                    message: "Missing rankId"
                });
            }

            endpoint = "/api/roblox/setrank";
            requestBody = {
                userId: userId,
                rankId: rankId
            };
        }

        const result = await rankGun(endpoint, requestBody);

        return send(res, 200, {
            success: true,
            result: result
        });

    } catch (error) {
        return send(res, 500, {
            success: false,
            message: error.message
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
