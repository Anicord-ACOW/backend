import {Router} from "express";
import {AuthorizationCode} from "simple-oauth2";
import {createAuthToken} from "@/helpers/auth-tokens";
import {encryptCookie, generateOAuthState, oAuthStateCookieName, verifyCookie} from "@/helpers/auth";
import {findOneOrCreate, getEntityManager} from "@/helpers/db";
import {User} from "@/helpers/models/user";
import {oauthRateLimiter} from "@/helpers/rate-limit";
import {APIError} from "@/helpers/api-error";

const router = Router();
const ID = "discord";

const client = new AuthorizationCode({
    client: {
        id: process.env.DISCORD_CLIENT_ID!,
        secret: process.env.DISCORD_CLIENT_SECRET!,
    },
    auth: {
        tokenHost: "https://discord.com",
        authorizePath: "/api/oauth2/authorize",
        tokenPath: "/api/oauth2/token",
        revokePath: "/api/oauth2/token/revoke",
    },
});

router.get("/auth/discord/login", oauthRateLimiter, (req, res) => {
    const state = generateOAuthState();
    res.cookie(oAuthStateCookieName(ID), encryptCookie(state), {
        signed: true,
        httpOnly: true,
        // secure: true,
        sameSite: "lax" as const,
        path: "/",
        maxAge: 1000 * 60 * 10, // 10 minutes
    });
    res.redirect(client.authorizeURL({
        redirect_uri: `${process.env.ORIGIN}/auth/discord/callback`,
        scope: ["identify", "guilds.members.read"],
        state,
    }));
});

router.get("/auth/discord/callback", oauthRateLimiter, async (req, res) => {
    // state check
    const returnedState = req.query.state;
    const storedState = req.signedCookies[oAuthStateCookieName(ID)];
    res.clearCookie(oAuthStateCookieName(ID), {
        signed: true,
        httpOnly: true,
        // secure: true,
        sameSite: "lax",
        path: "/",
    });
    if (!returnedState || !verifyCookie(storedState, returnedState as string)) {
        throw new APIError(400);
    }

    const {code} = req.query;
    if (!code) {
        throw new APIError(400);
    }

    // exchange code for access token
    const accessToken = await client.getToken({
        code: code as string,
        redirect_uri: `${process.env.ORIGIN}/auth/discord/callback`,
    });

    // check for discord server membership
    const resp = await fetch(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`, {
        headers: {
            "Authorization": `${accessToken.token.token_type} ${accessToken.token.access_token}`,
        }
    })
    if (resp.status !== 200) throw new APIError(403);

    // issue auth token identifying the discord user
    const data = await resp.json();
    const em = getEntityManager();
    const user = await findOneOrCreate(em, User, {id: BigInt(data.user.id)});
    user.username = data.user.username;
    await em.flush();
    const token = await createAuthToken({sub: data.user.id});

    res.json({success: true, token});
});

export default router;