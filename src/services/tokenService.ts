import jwt from "jsonwebtoken";
import { TokenRepository } from "../repositories/tokenRepository";
import { UnauthorizedError } from "../utils/errors";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  vendorProfileId: string | null;
}

export class TokenService {
  private tokenRepository: TokenRepository;
  private jwtSecret: string;
  private jwtRefreshSecret: string;

  constructor(tokenRepository = new TokenRepository()) {
    this.tokenRepository = tokenRepository;
    this.jwtSecret = process.env.JWT_SECRET || "vendorbridge_access_secret";
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "vendorbridge_refresh_secret";
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: "15m" });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign({ userId: payload.userId }, this.jwtRefreshSecret, { expiresIn: "7d" });
  }

  async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await this.tokenRepository.create(userId, token, expiresAt);
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired access token");
    }
  }

  async verifyRefreshToken(token: string) {
    try {
      jwt.verify(token, this.jwtRefreshSecret);
      const storedToken = await this.tokenRepository.findByToken(token);
      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedError("Refresh token is invalid or expired");
      }
      return storedToken;
    } catch (error) {
      throw new UnauthorizedError("Refresh token validation failed");
    }
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.tokenRepository.deleteByToken(token);
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.tokenRepository.deleteByUserId(userId);
  }
}

export const tokenService = new TokenService();
