import { Router, type IRouter } from "express";
import healthRouter from "./health";
import discordRouter from "./discord";
import communityFeaturesRouter from "./community-features";

const router: IRouter = Router();

router.use(healthRouter);
router.use(discordRouter);
router.use(communityFeaturesRouter);

export default router;
