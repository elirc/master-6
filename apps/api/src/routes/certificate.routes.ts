import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { prisma } from "../prisma.js";

export const certificateRouter = Router();

certificateRouter.get(
  "/verify/:verificationCode",
  asyncHandler(async (request, response) => {
    const certificate = await prisma.certificate.findUnique({
      include: {
        course: true,
        user: true
      },
      where: { verificationCode: String(request.params.verificationCode) }
    });

    if (!certificate) {
      throw new HttpError(404, "Certificate not found");
    }

    response.json({
      certificate: {
        courseTitle: certificate.course.title,
        issuedAt: certificate.issuedAt,
        learnerName: certificate.user.name,
        status: certificate.status,
        verificationCode: certificate.verificationCode
      }
    });
  })
);
