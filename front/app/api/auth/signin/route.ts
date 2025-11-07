// File: app/api/auth/signin/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongo-db";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    await connectDB();

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Use a generic message for security to not reveal if an email exists
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // --- START: MODIFIED SECTION ---

    // 1. Create the token payload (you can add more user data if needed)
    const tokenPayload = {
      id: user._id,
      username: user.fullName, // Using fullName as username
      email: user.email,
    };
    console.log('Token payload:', tokenPayload);

    // 2. Sign the JWT
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });
    console.log('JWT token created successfully');

    // 3. Create a JSON response for success
    const response = NextResponse.json(
      { 
        message: "Sign-in successful", 
        success: true,
        user: {
          id: user._id,
          username: user.fullName,
          email: user.email
        }
      },
      { status: 200 }
    );

    // 4. Set the token in an httpOnly cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
      maxAge: 60 * 60 * 24, // 1 day in seconds
      path: "/", // Cookie is available for all paths
    });

    return response;

    // --- END: MODIFIED SECTION ---

  } catch (error) {
    console.error("❌ Sign-in error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}