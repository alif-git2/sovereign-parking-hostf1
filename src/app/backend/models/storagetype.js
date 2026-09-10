import mongoose from "mongoose";

const StorageTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Storage type name is required"],
      trim: true,
      minlength: [2, "Storage type name must be at least 2 characters"],
      maxlength: [50, "Storage type name cannot exceed 50 characters"],
    },

    /**
     * Storage Type booking capacity
     *
     * 0 = Unlimited
     * > 0 = Maximum number of overlapping active bookings
     */
    capacity: {
      type: Number,
      default: 0,
      min: [0, "Storage type capacity cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Storage type capacity must be a whole number",
      },
    },
  },
  {
    timestamps: true,
  }
);

StorageTypeSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

const StorageType =
  mongoose.models.StorageType ||
  mongoose.model("StorageType", StorageTypeSchema);

export default StorageType;