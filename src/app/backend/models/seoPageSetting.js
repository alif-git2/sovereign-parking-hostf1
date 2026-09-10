import mongoose from "mongoose";

const allowedChangeFrequencies = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

const SeoPageSettingSchema = new mongoose.Schema(
  {
    page_name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 150,
    },

    path: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
      maxlength: 300,
    },

    meta_title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    meta_description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    keywords: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    canonical_url: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    og_title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    og_description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    og_image: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    twitter_title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    twitter_description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    twitter_image: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    noindex: {
      type: Boolean,
      default: false,
    },

    nofollow: {
      type: Boolean,
      default: false,
    },

    sitemap_enabled: {
      type: Boolean,
      default: true,
    },

    sitemap_priority: {
      type: Number,
      default: 0.8,
      min: 0,
      max: 1,
    },

    sitemap_changefreq: {
      type: String,
      enum: allowedChangeFrequencies,
      default: "weekly",
    },

    schema_json: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "seo_page_settings",
  }
);

SeoPageSettingSchema.pre("validate", function normalizeSeoPage() {
  if (this.path) {
    let cleanPath = String(this.path).trim();

    if (!cleanPath.startsWith("/")) {
      cleanPath = `/${cleanPath}`;
    }

    cleanPath = cleanPath.replace(/\/{2,}/g, "/");

    if (cleanPath.length > 1) {
      cleanPath = cleanPath.replace(/\/+$/, "");
    }

    this.path = cleanPath;
  }

  if (this.canonical_url) {
    this.canonical_url = String(this.canonical_url).trim();
  }

  if (this.og_image) {
    this.og_image = String(this.og_image).trim();
  }

  if (this.twitter_image) {
    this.twitter_image = String(this.twitter_image).trim();
  }

  if (this.noindex) {
    this.sitemap_enabled = false;
  }
});

SeoPageSettingSchema.index(
  {
    sitemap_enabled: 1,
    noindex: 1,
  },
  {
    name: "seo_page_sitemap_index",
  }
);

const SeoPageSetting =
  mongoose.models.SeoPageSetting ||
  mongoose.model("SeoPageSetting", SeoPageSettingSchema);

export default SeoPageSetting;
