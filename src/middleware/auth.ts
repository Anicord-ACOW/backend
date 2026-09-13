import {NextFunction, Request, Response} from "express";
import {verifyAuthToken} from "@/helpers/auth-tokens";
import {User} from "@/helpers/models/user";
import {APIError} from "@/helpers/api-error";
import {AUTH_TOKEN_COOKIE_NAME} from "@/helpers/auth";

// Helper to get token from either cookie name
function getCookieToken(req: Request): string | undefined {
    return req.cookies[AUTH_TOKEN_COOKIE_NAME] || req.cookies['auth-token'];
}

export async function auth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization || req.cookies[AUTH_TOKEN_COOKIE_NAME];
    if (token === undefined) return next();

    try {
        const payload = verifyAuthToken(token);
        const user = await req.em.findOne(User, BigInt(payload.sub!), {populate: ["roles"]});
        if (user) {
            req.auth = user;
        }
    } catch (_) {
        console.warn("Failed to verify auth token");
    }
    next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    auth(req, res, () => {
        if (req.auth === undefined) return next(new APIError(401));
        next();
    });
}

export function requireAllRoles(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => auth(req, res, () => {
        if (req.auth === undefined) return next(new APIError(401));
        const userRoles = req.auth!.roles.getItems();
        if (!roles.reduce((acc, role) => acc && userRoles.some(x => x.role === role), true)) return next(new APIError(403));
        next();
    });
}