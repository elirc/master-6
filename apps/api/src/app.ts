import cors from "cors";
import express from "express";
import morgan from "morgan";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { authoringRouter } from "./routes/authoring.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { certificateRouter } from "./routes/certificate.routes.js";
import { learnerRouter } from "./routes/learner.routes.js";
import { platformRouter } from "./routes/platform.routes.js";
import { errorHandler } from "./http.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.use("/auth", authRouter);
  app.use("/catalog", catalogRouter);
  app.use("/authoring", authoringRouter);
  app.use("/learner", learnerRouter);
  app.use("/admin", adminRouter);
  app.use("/certificates", certificateRouter);
  app.use("/platform", platformRouter);

  app.use(errorHandler);

  return app;
}
