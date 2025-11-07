// File: app/api/auth/me/route.ts

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// Helper function to get data from a token
const getDataFromToken = (request: NextRequest) => {
  try {
    const token = request.cookies.get("token")?.value || "";
    if (!token) {
      return null;
    }
    const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decodedToken; // This will contain { id, username, email }
  } catch (error: any) {
    // This will happen if the token is expired or invalid
    return null;
  }
};


export async function GET(request: NextRequest) {
  try {
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    const userData = getDataFromToken(request);
    console.log('Decoded user data:', userData);

    if (!userData) {
      console.log('No user data found in token');
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // You can also fetch fresh data from the DB if needed
    // const user = await User.findById(userData.id).select("-password");

    return NextResponse.json({
      message: "User found",
      data: userData,
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}