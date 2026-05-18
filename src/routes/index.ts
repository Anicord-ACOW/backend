import {Router} from "express";
import auth from "@/routes/auth";
import users from "@/routes/users";
import seasons from "@/routes/seasons";

const router = Router();

router.use("/", auth);
router.use("/", users);
router.use("/", seasons);

export default router;