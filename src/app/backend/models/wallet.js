import mongoose from "mongoose";

const WalletTransactionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      required: true
    },

    type: {
      type: String,
      enum: ["credit", "debit", "refund", "topup", "withdraw"],
      required: true
    },

    amount: { type: Number, required: true },
    
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking"
    },
    
    // ADDED: To track if money came from Stripe, PayPal, or Wallet
    method: {
      type: String,
      enum: ["stripe", "paypal", "wallet", "cash"],
      required: true
    },
    // ADDED: The pi_... or capture_id from Stripe/PayPal
    transaction_id: {
      type: String,
      required: function () { return this.type === "topup"; }
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending"
    },
    note: String,
  },
  { timestamps: { createdAt: true, updatedAt: true } } // UpdatedAt helps track when Admin approved
);

const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", WalletTransactionSchema);
export default WalletTransaction;