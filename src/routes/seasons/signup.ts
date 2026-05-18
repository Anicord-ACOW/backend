import {Router} from "express";
import {Season} from "@/helpers/models/season/season";
import {throwIfAfter, throwIfBefore} from "@/helpers/date";
import {APIError} from "@/helpers/api-error";
import {findOneOrCreate} from "@/helpers/db";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";
import {requireAllRoles, requireAuth} from "@/middleware/auth";
import {SignUpSchema} from "@/helpers/models/season/signup";

const router = Router();

router.post("/seasons/:id/signup", writeRateLimiter, requireAuth, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    throwIfAfter(season.signupsEnd, "Signups have ended");
    throwIfBefore(season.signupsStart, "Signups have not started");
    await findOneOrCreate(req.em, SignUpSchema, {season: season.id, user: req.auth!});
    await req.em.flush();
    res.json({success: true});
});

router.delete("/seasons/:id/signup", writeRateLimiter, requireAuth, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    throwIfAfter(season.signupsEnd, "Signups have ended");
    throwIfBefore(season.signupsStart, "Signups have not started");
    const signup = await req.em.findOne(SignUpSchema, {season: season.id, user: req.auth!.id});
    if (signup) {
        req.em.remove(signup);
    }
    await req.em.flush();
    res.json({success: true});
});

router.get("/seasons/:id/signup", readRateLimiter, requireAuth, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    const signup = await req.em.findOne(SignUpSchema, {season: season.id, user: req.auth!.id});
    res.json({success: true, signedUp: !!signup});
});

router.get("/seasons/:id/signups", readRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    const signups = await req.em.find(SignUpSchema, {season: season.id}, {populate: ["user"]});
    res.json({success: true, signups});
});

export default router;