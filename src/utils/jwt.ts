import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as TokenPayload;
};
