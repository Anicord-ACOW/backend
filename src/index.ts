try {
    process.loadEnvFile(".env");
} catch {}

// check if we have all the env vars we need
const REQUIRED_ENV_VARS = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_SERVER_ID", "COOKIE_SECRET", "MYSQL", "ORIGIN"];
for (const varName of REQUIRED_ENV_VARS) {
    if (process.env[varName] === undefined) {
        throw new Error(`Missing required environment variable: ${varName}. Did you read the README?`);
    }
}

void import("@/app").then(({default: app}) => {
    app.listen(3000, (err) => {
        if (err) throw err;
        console.log("Server is running on port 3000");
    });
});
