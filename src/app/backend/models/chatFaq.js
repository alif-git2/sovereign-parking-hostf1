import mongoose from "mongoose";

const ChatFaqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },

    keywords: {
      type: [String],
      default: [],
    },

    answer: {
      type: String,
      required: true,
      trim: true,
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },

    sort_order: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ChatFaqSchema.pre("validate", function () {
  if (this.question) {
    this.question = String(this.question).trim();
  }

  if (this.answer) {
    this.answer = String(this.answer).trim();
  }

  if (Array.isArray(this.keywords)) {
    this.keywords = this.keywords
      .map((keyword) => String(keyword || "").toLowerCase().trim())
      .filter(Boolean);
  }
});

ChatFaqSchema.index({
  question: "text",
  answer: "text",
  keywords: "text",
});

const ChatFaq =
  mongoose.models.ChatFaq || mongoose.model("ChatFaq", ChatFaqSchema);

export default ChatFaq;