import mongoose from "mongoose";

const SeoGlobalSettingSchema = new mongoose.Schema(
  {
    site_name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    site_url: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },

    default_meta_title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    default_meta_description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    default_keywords: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    default_og_image: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    google_site_verification: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },

    google_analytics_id: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },

    facebook_pixel_id: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },

    default_noindex: {
      type: Boolean,
      default: false,
    },

    default_nofollow: {
      type: Boolean,
      default: false,
    },

    sitemap_enabled: {
      type: Boolean,
      default: true,
    },

    robots_txt: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10000,
    },
  },
  {
    timestamps: true,
    collection: "seo_global_settings",
  }
);

SeoGlobalSettingSchema.pre("validate", function normalizeSeoGlobal() {
  if (this.site_url) {
    this.site_url = String(this.site_url).trim().replace(/\/+$/, "");
  }

  if (this.default_og_image) {
    this.default_og_image = String(this.default_og_image).trim();
  }
});

const SeoGlobalSetting =
  mongoose.models.SeoGlobalSetting ||
  mongoose.model("SeoGlobalSetting", SeoGlobalSettingSchema);

export default SeoGlobalSetting;
