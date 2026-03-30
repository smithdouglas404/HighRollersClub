import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import clubsRouter from "./clubs";
import tablesRouter from "./tables";
import gamesRouter from "./games";
import tournamentsRouter from "./tournaments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(clubsRouter);
router.use(tablesRouter);
router.use(gamesRouter);
router.use(tournamentsRouter);

export default router;
