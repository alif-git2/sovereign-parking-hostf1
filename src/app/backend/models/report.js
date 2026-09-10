import mongoose from "mongoose";

const ReportColumnSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const AdminReportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Report name is required"],
      trim: true,
      maxlength: [120, "Report name cannot exceed 120 characters"],
    },

    report_type: {
      type: String,
      enum: ["cruise", "storage", "airport"],
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      default: "",
    },

    date_label: {
      type: String,
      trim: true,
      default: "All dates",
    },

    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    selected_columns: {
      type: [String],
      default: [],
    },

    columns: {
      type: [ReportColumnSchema],
      default: [],
    },

    // Snapshot rows are saved permanently so old reports do not change when
    // bookings are edited later.
    rows: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    total_rows: {
      type: Number,
      default: 0,
      min: 0,
    },

    total_value: {
      type: Number,
      default: 0,
      min: 0,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingUser",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

AdminReportSchema.index({ createdAt: -1 });
AdminReportSchema.index({ report_type: 1, createdAt: -1 });

const AdminReport =
  mongoose.models.AdminReport ||
  mongoose.model("AdminReport", AdminReportSchema);

export default AdminReport;
