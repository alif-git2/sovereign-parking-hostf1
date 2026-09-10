import mongoose from "mongoose";

const BLOG_STATUS = ["draft", "published", "archived"];

function cleanString(value = "") {
  return String(value || "").trim();
}

function createSlug(value = "") {
  return cleanString(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const BlogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 180,
    },

    slug: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      maxlength: 150,
    },

    excerpt: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    content: {
      type: String,
      default: "",
    },

    featured_image: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    featured_image_alt: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    category: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
      index: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    author_name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    status: {
      type: String,
      enum: BLOG_STATUS,
      default: "draft",
      index: true,
    },

    is_featured: {
      type: Boolean,
      default: false,
    },

    published_at: {
      type: Date,
      default: null,
      index: true,
    },

    views_count: {
      type: Number,
      default: 0,
      min: 0,
    },

    reading_time_minutes: {
      type: Number,
      default: 1,
      min: 1,
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

    meta_keywords: {
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
      default: 0.7,
      min: 0,
      max: 1,
    },

    sitemap_changefreq: {
      type: String,
      enum: [
        "always",
        "hourly",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "never",
      ],
      default: "monthly",
    },

    schema_json: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "blog_posts",
  }
);

BlogPostSchema.pre("validate", function normalizeBlogPost() {
  if (!this.slug && this.title) {
    this.slug = createSlug(this.title);
  }

  if (this.slug) {
    this.slug = createSlug(this.slug);
  }

  if (!this.slug) {
    this.invalidate("slug", "Slug is required.");
  }

  if (Array.isArray(this.tags)) {
    this.tags = [
      ...new Set(
        this.tags
          .map((tag) => cleanString(tag))
          .filter(Boolean)
          .map((tag) => tag.slice(0, 60))
      ),
    ];
  }

  if (this.category) {
    this.category = cleanString(this.category);
  }

  if (this.canonical_url) {
    this.canonical_url = cleanString(this.canonical_url);
  }

  if (this.featured_image) {
    this.featured_image = cleanString(this.featured_image);
  }

  if (this.og_image) {
    this.og_image = cleanString(this.og_image);
  }

  if (this.twitter_image) {
    this.twitter_image = cleanString(this.twitter_image);
  }

  if (this.status === "published" && !this.published_at) {
    this.published_at = new Date();
  }

  if (this.status !== "published") {
    this.published_at = null;
  }

  if (this.noindex) {
    this.sitemap_enabled = false;
  }

  const plainText = cleanString(this.content).replace(/<[^>]*>/g, " ");
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  this.reading_time_minutes = Math.max(1, Math.ceil(wordCount / 220));
});

BlogPostSchema.index(
  {
    status: 1,
    published_at: -1,
  },
  {
    name: "blog_public_listing_index",
  }
);

BlogPostSchema.index(
  {
    category: 1,
    status: 1,
    published_at: -1,
  },
  {
    name: "blog_category_listing_index",
  }
);

BlogPostSchema.index(
  {
    sitemap_enabled: 1,
    noindex: 1,
    status: 1,
  },
  {
    name: "blog_sitemap_index",
  }
);

BlogPostSchema.index(
  {
    title: "text",
    excerpt: "text",
    content: "text",
    tags: "text",
  },
  {
    name: "blog_search_text_index",
  }
);

const BlogPost =
  mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);

export default BlogPost;
