import { NextResponse, NextRequest } from "next/server";
import { connectDB } from "@/lib/mongo-db";
import Conversation from "@/models/conversations";
import Message from "@/models/message";
import { getUserFromToken } from "@/lib/getUserFromToken";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // 🔹 Authenticate user
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 🔹 Fetch conversations for that user
    const userConversations = await Conversation.find({ user: userId }).select(
      "_id"
    );
    const conversationIds = userConversations.map((c) => c._id);

    const totalConversations = userConversations.length;

    const totalMessages = await Message.countDocuments({
      conversation: { $in: conversationIds },
    });

    // 🔹 Fetch recent chats
    const recentChats = await Conversation.find({ user: userId })
      .sort({ lastMessageAt: -1 })
      .limit(5)
      .lean();

    // 🔹 Weekly Activity (last 7 days)
    const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyDataRaw = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: last7days },
          // Ensure ObjectId match inside aggregation
          user: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" }, // 1=Sun, 2=Mon...
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // 🔹 Convert Mongo → Frontend Format (Mon-Sun)
    // Mongo: 1=Sun, 2=Mon ... 7=Sat
    const mongoToIndex = {
      2: 0, // Mon
      3: 1, // Tue
      4: 2, // Wed
      5: 3, // Thu
      6: 4, // Fri
      7: 5, // Sat
      1: 6, // Sun
    };

    const output = [
      { day: "Mon", value: 0 },
      { day: "Tue", value: 0 },
      { day: "Wed", value: 0 },
      { day: "Thu", value: 0 },
      { day: "Fri", value: 0 },
      { day: "Sat", value: 0 },
      { day: "Sun", value: 0 },
    ];

    weeklyDataRaw.forEach((item) => {
      const index = mongoToIndex[item._id];
      if (index !== undefined) {
        output[index].value = item.count;
      }
    });

    // 🔹 Avg Response Time
    const messages = await Message.find({
      conversation: { $in: conversationIds },
    })
      .sort({ createdAt: 1 })
      .lean();

    let avgResponseTime = 0;
    if (messages.length > 1) {
      let total = 0;
      for (let i = 1; i < messages.length; i++) {
        total +=
          new Date(messages[i].createdAt).getTime() -
          new Date(messages[i - 1].createdAt).getTime();
      }

      avgResponseTime = Math.round(
        total / (messages.length - 1) / 60000
      );
    }

    // 🔹 Return dashboard response
    return NextResponse.json({
      success: true,
      stats: {
        totalConversations,
        totalMessages,
        avgResponseTime,
        weeklyData: output,
        recentChats,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
