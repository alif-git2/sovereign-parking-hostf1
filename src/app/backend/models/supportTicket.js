import mongoose from "mongoose";

const SupportTicketSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    booking_id: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["open", "in_progress", "replied", "closed"],
      default: "open",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },

    source: {
      type: String,
      enum: ["chat_widget", "admin", "customer_dashboard"],
      default: "chat_widget",
    },

    admin_reply: {
      type: String,
      default: "",
      trim: true,
    },

    admin_replied_at: {
      type: Date,
      default: null,
    },

    closed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

SupportTicketSchema.pre("validate", function () {
  if (this.email) {
    this.email = String(this.email).toLowerCase().trim();
  }

  if (this.name) {
    this.name = String(this.name).trim();
  }

  if (this.phone) {
    this.phone = String(this.phone).trim();
  }

  if (this.booking_id) {
    this.booking_id = String(this.booking_id).trim();
  }

  if (this.message) {
    this.message = String(this.message).trim();
  }

  if (!this.priority) {
    this.priority = "normal";
  }

  if (!this.status) {
    this.status = "open";
  }
});

SupportTicketSchema.index({ createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });

const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model("SupportTicket", SupportTicketSchema);

export default SupportTicket;