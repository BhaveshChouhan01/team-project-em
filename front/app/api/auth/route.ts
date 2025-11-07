import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo-db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // 1️⃣ Validate request
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    // 2️⃣ Connect to MongoDB
    await connectDB();

    // 3️⃣ Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // 4️⃣ Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid password" }, { status: 401 });
    }

    // 5️⃣ Remove password before sending user data
    const { password: _, ...userData } = user.toObject();

    // 6️⃣ Return success response
    return NextResponse.json(
      {
        message: "Login successful",
        user: userData,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Login Error:", error);
    return NextResponse.json(
      { message: "Server error, please try again later" },
      { status: 500 }
    );
  }
}
