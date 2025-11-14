import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export interface TokenUser {
  id: string;
  username: string;
  email: string;
}

export function getUserFromToken(request: NextRequest): TokenUser | null {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenUser;
    return decoded;
  } catch (err) {
    return null;
  }
}
