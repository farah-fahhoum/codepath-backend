import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { checkUserRoleForAuth } from "../repositories/user.repo";
import { authResponse } from "../types/user.type";

let message: authResponse;

export const authorize =
  (allowedRoles: ("Mentee" | "Admin" | string)[], allowGuest: boolean) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer") ||
      !req.headers.authorization.split(" ")[1]
    ) {
      if (allowGuest) {
        return next();
      }
      message = "Provide a token";
      return res.status(422).json({ message });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as jwt.JwtPayload;

      const userRole = await checkUserRoleForAuth(decoded.id);

      if (allowedRoles.includes(userRole.role)) {
        req.user = {
          id: decoded.id,
        };
        return next();
      } else {
        message = "Unauthorized";
        return res.status(401).json({ message });
      }
    } catch (error) {
      if (allowGuest) {
        return next(); // Allow guest access even if token verification fails
      }
      message = "Invalid token";
      return res.status(401).json({ message });
    }
  };
