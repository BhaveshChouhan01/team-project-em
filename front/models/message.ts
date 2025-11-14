// front/models/Message.ts
import mongoose, { Schema, Types } from "mongoose";

export type Role = "user" | "assistant" | "system";

export interface IMessage {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender?: Types.ObjectId;       // for user messages; optional for assistant
  role: Role;                    // "user" | "assistant" | "system"
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// Common queries become fast:
MessageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);
