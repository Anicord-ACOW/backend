import {Request, Router} from "express";
import {findOneOrCreate, getEntityManager} from "@/helpers/db";
import {SignUpFormSchema, SignupForm} from "@/helpers/models/season/signup";
import {parseModelPatch} from "@/helpers/patch";
import {requireAllRoles, requireAuth} from "@/middleware/auth";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";

const router = Router();

router.get("/users/me/signup-form", readRateLimiter, requireAuth, async (req, res) => {
    const userId = req.auth!.id;

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    res.json({
        success: true,
        form,
    });
});

import {Contract} from "@/helpers/models/contracts/contract";
import {APIError} from "@/helpers/api-error";

router.get("/users/:userId/signup-form", readRateLimiter, requireAuth, async (req, res) => {
    const userId = BigInt(req.params.userId as string);
    const em = getEntityManager();

    const userRoles = req.auth!.roles.getItems();
    const isAdmin = userRoles.some(x => x.role === "admin");
    const isSelf = req.auth!.id === userId;

    if (!isAdmin && !isSelf) {
        // Check if req.auth is the contractor for this user in an active contract
        const activeContract = await em.findOne(Contract, {
            contractor: req.auth!.id,
            contractee: userId,
            season: {completed: false},
        });
        if (!activeContract) {
            throw new APIError(403, "Not authorized to view this user's preferences");
        }
    }

    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    res.json({
        success: true,
        form,
    });
});

router.patch("/users/me/signup-form", writeRateLimiter, requireAuth, async (req, res) => {
    const userId = req.auth!.id;

    const result = parseModelPatch(req.body, SignUpFormSchema);

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    Object.assign(form, result);
    await em.flush();

    res.json({
        success: true,
        form,
    });
});

router.patch("/users/:userId/signup-form", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const userId = BigInt(req.params.userId as string);

    const result = parseModelPatch(req.body, SignUpFormSchema);

    const em = getEntityManager();
    const form = await findOneOrCreate(em, SignupForm, {user: userId});
    Object.assign(form, result);
    await em.flush();

    res.json({
        success: true,
        form,
    });
});

export default router;
