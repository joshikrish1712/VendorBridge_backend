import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { tokenService, TokenPayload } from "../services/tokenService";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Access token is missing or malformed"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = tokenService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(roles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!roles.includes(req.user.role as Role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${roles.join(", ")}`
        )
      );
    }

    next();
  };
}
