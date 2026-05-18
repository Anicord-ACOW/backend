import {NextFunction, Request, Response} from "express";
import {verifyAuthToken} from "@/helpers/auth-tokens";
import {Role, User} from "@/helpers/models/user";
import {APIError} from "@/helpers/api-error";

export async function auth(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;
    if (token === undefined) return next();

    const payload = verifyAuthToken(token);
    const user = await req.em.findOne(User, BigInt(payload.sub!), {populate: ["roles"]});
    if (user) {
        req.auth = user;
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
    return (req: Request, res: Response, next: NextFunction) => requireAuth(req, res, () => {
        const userRoles = req.auth!.roles.getItems();
        if (!roles.reduce((acc, role) => acc && userRoles.some(x => x.role === role), true)) return next(new APIError(403));
        next();
    });
}