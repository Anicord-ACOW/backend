import {Router} from "express";
import {readRateLimiter, writeRateLimiter} from "@/helpers/rate-limit";
import {requireAllRoles} from "@/middleware/auth";
import {Season, SeasonSchema} from "@/helpers/models/season/season";
import {parseModelPatch} from "@/helpers/patch";
import contracts from "@/routes/seasons/contracts";
import {APIError} from "@/helpers/api-error";
import signup from "@/routes/seasons/signup";

const router = Router();

router.post("/seasons", writeRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    // check if there's an active season
    const incompleteSeasons = await req.em.find(Season, {completed: false});
    if (incompleteSeasons.length > 0) {
        throw new APIError(400, "Cannot create a new season while there is an active season");
    }

    const result = parseModelPatch(req.body, SeasonSchema, {
        exclude: ["completed"],
    });
    // date consistency check
    if (!result.signupsStart || result.signupsStart < new Date()) throw new APIError(400, "Signups start must be in the future");
    if (!result.signupsEnd || result.signupsEnd < result.signupsStart) throw new APIError(400, "Signups end must be after signups start");

    const season = req.em.create(Season, result, {partial: true});
    await req.em.flush();
    res.json({success: true, season});
});

router.get("/seasons/:id", readRateLimiter, async (req, res) => {
    const season = await Season.getSeasonById(req.em, req.params.id as string);
    if (season === null) throw new APIError(404, "Season not found");
    res.json({success: true, season});
});

router.use("/", contracts);
router.use("/", signup);

export default router;