import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo-db";
import Conversation from "@/models/conversations";
import { getUserFromToken } from "@/lib/getUserFromToken";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const title = body.title?.trim() || "New Conversation";

    const convo = await Conversation.create({
      user: user.id,              // 👈 ALWAYS attach correct user
      title,
      lastMessageAt: new Date(),
    });

    return NextResponse.json({ success: true, data: convo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await Conversation.find({ user: user.id })  // 👈 Filter by logged-in user ONLY
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
