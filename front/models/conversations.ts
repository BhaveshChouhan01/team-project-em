import mongoose, { Schema, Types } from "mongoose";

export interface IConversation {
  _id: Types.ObjectId;
  user: Types.ObjectId;          // 👈 make required
  title?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },  // ✅ FIXED
    title: { type: String, default: "New Conversation" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ConversationSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);
