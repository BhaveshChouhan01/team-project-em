import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo-db";
import Conversation from "@/models/conversations";
import { getUserFromToken } from "@/lib/getUserFromToken";

function generateTitle(text: string) {
  if (!text) return "New Conversation";

  const cleaned = text.trim();
  if (cleaned.length <= 30) return cleaned;

  return cleaned.substring(0, 30) + "...";
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
     console.log("📥 Received body:", body);

    // 👇 Use the FIRST MESSAGE to auto-generate title
    const firstMessage = body.firstMessage || "";
    const title = generateTitle(firstMessage);

    const convo = await Conversation.create({
      user: user.id,
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

    const list = await Conversation.find({ user: user.id })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
