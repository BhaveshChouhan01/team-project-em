import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo-db";
import Conversation from "@/models/conversations";
import Message from "@/models/message";
import { getUserFromToken } from "@/lib/getUserFromToken";
import { Types } from "mongoose";

// ===============================
// POST — Send a message
// ===============================
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, role, content } = await req.json();
    if (!conversationId || !role || !content) {
      return NextResponse.json(
        { success: false, error: "conversationId, role, content required" },
        { status: 400 }
      );
    }

    // 🔐 Check ownership
    const convo = await Conversation.findOne({
      _id: conversationId,
      user: new Types.ObjectId(user.id),
    });

    if (!convo) {
      return NextResponse.json(
        { success: false, error: "Conversation not found or unauthorized" },
        { status: 403 }
      );
    }

  const msg = await Message.create({
  conversation: new Types.ObjectId(conversationId),
  role,
  content,
  sender: role === "user" ? new Types.ObjectId(user.id) : null, // ⭐ REQUIRED
});


    convo.lastMessageAt = new Date();
    await convo.save();

    return NextResponse.json({ success: true, data: msg });
  } catch (e: any) {
    console.error("❌ /api/messages POST error:", e);
    return NextResponse.json(
      { success: false, error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ===============================
// GET — Load messages
// ===============================
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const limit = Number(searchParams.get("limit") || 50);
    const cursor = searchParams.get("cursor");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "conversationId required" },
        { status: 400 }
      );
    }

    // 🔐 Secure ownership check
    const convo = await Conversation.findOne({
      _id: conversationId,
      user: new Types.ObjectId(user.id),
    });

    if (!convo) {
      return NextResponse.json(
        { success: false, error: "Conversation not found or unauthorized" },
        { status: 403 }
      );
    }

    const query: any = { conversation: new Types.ObjectId(conversationId) }; // ✅ FIXED
    if (cursor) query.createdAt = { $lt: new Date(cursor) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: messages.reverse(),
      nextCursor: messages.length ? messages[0].createdAt : null,
    });
  } catch (e: any) {
    console.error("❌ /api/messages GET error:", e);
    return NextResponse.json(
      { success: false, error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
