import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import camerasRouter from "./cameras.js";
import analyticsRouter from "./analytics.js";
import alertsRouter from "./alerts.js";
import reportsRouter from "./reports.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(camerasRouter);
router.use(analyticsRouter);
router.use(alertsRouter);
router.use(reportsRouter);

export default router;
