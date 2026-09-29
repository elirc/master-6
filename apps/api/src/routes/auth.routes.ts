import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { asyncHandler, HttpError, type AuthedRequest } from "../http.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      },
      where: { email: input.email }
    });

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }

    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: "8h" });
    response.json({
      token,
      user: {
        email: user.email,
        id: user.id,
        memberships: user.memberships.map((membership) => ({
          organization: membership.organization,
          role: membership.role
        })),
        name: user.name
      }
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({ user: (request as AuthedRequest).user });
  })
);
