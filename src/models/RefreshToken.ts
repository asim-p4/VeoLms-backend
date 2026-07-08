import mongoose, { Document, Schema } from "mongoose";

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);