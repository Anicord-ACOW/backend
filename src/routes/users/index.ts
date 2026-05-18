import {Router} from "express";
import signup from "@/routes/users/signup";
import {readRateLimiter} from "@/helpers/rate-limit";
import {requireAllRoles, requireAuth} from "@/middleware/auth";
import {getEntityManager} from "@/helpers/db";
import {User} from "@/helpers/models/user";
import {APIError} from "@/helpers/api-error";

const router = Router();

router.get("/users/me", readRateLimiter, requireAuth, async (req, res) => {
    const em = getEntityManager();
    res.json({
        success: true,
        user: req.auth,
    });
});

router.get("/users/:id", readRateLimiter, requireAllRoles(["admin"]), async (req, res) => {
    const em = getEntityManager();
    const user = await em.findOne(User, req.params.id, {populate: ["roles"]});
    if (user === null) throw new APIError(404, "User not found");
    res.json({
        success: true,
        user,
    });
});

router.use(signup);

export default router;