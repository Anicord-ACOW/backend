import {timingSafeEqual} from "crypto";
import {createAuthToken, verifyAuthToken} from "@/helpers/auth-tokens";
import {APIError} from "@/helpers/api-error";

export const IS_PROD = process.env.NODE_ENV === "production";
export const AUTH_TOKEN_COOKIE_NAME = IS_PROD ? "__Host-auth-token" : "auth-token";

export function generateOAuthState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function oAuthStateCookieName(provider: string) {
    if (IS_PROD) return `__Host-oauth-state-${provider}`;
    return `oauth-state-${provider}`;
}

export function encryptCookie(cleartext: string, payload: Record<string, unknown> = {}) {
    return createAuthToken({...payload, state: cleartext}, {expiresIn: "10m"})
}

export function verifyCookie(ciphertext: string, cleartext: string) {
    try {
        const payload = verifyAuthToken(ciphertext);
        if (timingSafeEqual(Buffer.from(payload.state), Buffer.from(cleartext))) {
            return payload;
        }
    } catch (e) {
        throw new APIError(400);
    }
    throw new APIError(403);
}