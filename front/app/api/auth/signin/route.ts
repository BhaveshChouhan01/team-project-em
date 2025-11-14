import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongo-db";
import User from "@/models/User";

/**
 * POST /api/auth/signin
 * Handles user login and JWT token generation.
 */
export async function POST(req: Request) {
  const start = Date.now();
  try {
    // --- 1. Connect to MongoDB ---
    await connectDB();

    // --- 2. Parse request body ---
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    // --- 3. Find the user ---
    // Ensure password field is selected in case schema sets select:false for it
    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.password) {
      // Generic message for security (do not reveal if user exists)
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // --- 4. Compare passwords ---
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // --- 5. Verify JWT secret is set ---
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables.");
    }

    // --- 6. Create JWT payload ---
    const tokenPayload = {
      id: user._id.toString(),
      username: user.fullName || user.username || "User",
      email: user.email,
    };

    // --- 7. Sign the JWT token ---
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "1d", // 1 day
    });

    // --- 8. Prepare success response ---
    const response = NextResponse.json(
      {
        message: "Sign-in successful",
        success: true,
        user: {
          id: user._id,
          username: user.fullName || user.username || "User",
          email: user.email,
        },
      },
      { status: 200 }
    );

    // --- 9. Set the token in an HTTP-only cookie ---
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    // --- 10. Return success response ---
    const duration = Date.now() - start;
    console.log(`✅ Sign-in success for ${email} (${duration}ms)`);
    return response;

  } catch (error: any) {
    // --- 11. Handle all errors gracefully ---
    const duration = Date.now() - start;
    console.error(`❌ Sign-in error (${duration}ms):`, error?.message, "\nStack:", error?.stack);
    return NextResponse.json(
      { message: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
