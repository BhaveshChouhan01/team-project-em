import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongo-db';  // ✅ Changed here
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password } = await req.json();

    // Validation
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();  // ✅ Changed here

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
    });

    // Create JWT token for immediate authentication
    const tokenPayload = {
      id: newUser._id,
      username: newUser.fullName, // Using fullName as username
      email: newUser.email,
    };
    console.log('Signup token payload:', tokenPayload);

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });
    console.log('Signup JWT token created successfully');

    // Create response with user data and set cookie
    const response = NextResponse.json(
      {
        message: 'User created successfully',
        success: true,
        user: {
          id: newUser._id,
          username: newUser.fullName,
          email: newUser.email,
        },
      },
      { status: 201 }
    );

    // Set the token in an httpOnly cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}