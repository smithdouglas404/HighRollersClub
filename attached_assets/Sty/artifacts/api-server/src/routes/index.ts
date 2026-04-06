import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clubsRouter from "./clubs";
import tablesRouter from "./tables";
import gamesRouter from "./games";
import tournamentsRouter from "./tournaments";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(clubsRouter);
router.use(tablesRouter);
router.use(gamesRouter);
router.use(tournamentsRouter);
router.use(walletRouter);

export default router;
