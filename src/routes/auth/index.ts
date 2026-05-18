import {Router} from "express";
import discord from "@/routes/auth/discord";

const router = Router();

router.use("/", discord);

export default router;