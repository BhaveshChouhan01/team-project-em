// File: app/api/auth/me/route.ts

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const getDataFromToken = (request: NextRequest) => {
  try {
    const token = request.cookies.get("token")?.value || "";
    if (!token) return null;

    const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET!);

    return {
      id: decodedToken.id,      // 🔥 REQUIRED, backend uses this
      email: decodedToken.email,
      username: decodedToken.username,
    };

  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  try {
    const userData = getDataFromToken(request);

    if (!userData) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: userData,       // 👈 return consistent format
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
