import "dotenv/config";

export const config = {
  apiPort: Number(process.env.API_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "development-only-secret",
  nodeEnv: process.env.NODE_ENV ?? "development",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379"
};
