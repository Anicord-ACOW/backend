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

router.get("/users/:userId/signup-form", readRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const userId = BigInt(req.params.userId as string);

    const em = getEntityManager();
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
