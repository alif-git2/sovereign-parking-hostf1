import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import Navbar from "@/app/frontend/component/global/NavBar";
import Footer from "@/app/frontend/component/global/Footer";
import BlogPost from "@/app/backend/models/blogPost";
import SeoGlobalSetting from "@/app/backend/models/seoGlobalSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing.");
  }

  await mongoose.connect(mongoUri);
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getSiteUrl(globalSeo = {}) {
  return String(
    globalSeo.site_url ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function isAbsoluteUrl(value = "") {
  return /^https?:\/\//i.test(cleanString(value));
}

function buildAbsoluteUrl(value = "", globalSeo = {}) {
  const cleanValue = cleanString(value);

  if (!cleanValue) return "";

  if (isAbsoluteUrl(cleanValue)) {
    return cleanValue;
  }

  const siteUrl = getSiteUrl(globalSeo);

  if (cleanValue.startsWith("/")) {
    return `${siteUrl}${cleanValue}`;
  }

  return `${siteUrl}/${cleanValue}`;
}

function getBlogUrl(post, globalSeo = {}) {
  return buildAbsoluteUrl(
    cleanString(post.canonical_url) || `/blog/${post.slug}`,
    globalSeo
  );
}

function getDescription(post) {
  return (
    cleanString(post.meta_description) ||
    cleanString(post.excerpt) ||
    stripHtml(post.content).slice(0, 160)
  );
}

function getOpenGraphImage(post, globalSeo = {}) {
  return buildAbsoluteUrl(
    cleanString(post.og_image) ||
      cleanString(post.featured_image) ||
      cleanString(globalSeo.default_og_image) ||
      cleanString(post.twitter_image),
    globalSeo
  );
}

function getTwitterImage(post, globalSeo = {}) {
  return buildAbsoluteUrl(
    cleanString(post.twitter_image) ||
      cleanString(post.og_image) ||
      cleanString(post.featured_image) ||
      cleanString(globalSeo.default_og_image),
    globalSeo
  );
}

function sanitizeHtml(value = "") {
  let html = String(value || "");

  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/\son\w+="[^"]*"/gi, "");
  html = html.replace(/\son\w+='[^']*'/gi, "");
  html = html.replace(/\s(href|src)=["']javascript:[^"']*["']/gi, "");

  return html;
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

async function getPostBySlug(slug) {
  await connectToDatabase();

  return BlogPost.findOne({
    slug,
    status: "published",
  }).lean();
}

async function getRecentPosts(currentPost) {
  await connectToDatabase();

  return BlogPost.find({
    _id: {
      $ne: currentPost._id,
    },
    status: "published",
  })
    .sort({
      published_at: -1,
      createdAt: -1,
    })
    .limit(5)
    .lean();
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = cleanString(resolvedParams?.slug);

  await connectToDatabase();

  const [post, globalSeo] = await Promise.all([
    BlogPost.findOne({
      slug,
      status: "published",
    }).lean(),
    SeoGlobalSetting.findOne({}).lean(),
  ]);

  if (!post) {
    return {
      title: "Blog Post Not Found | Sovereign Park",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title =
    cleanString(post.meta_title) ||
    `${post.title} | ${cleanString(globalSeo?.site_name) || "Sovereign Park"}`;

  const description = getDescription(post);
  const canonicalUrl = getBlogUrl(post, globalSeo || {});
  const openGraphImage = getOpenGraphImage(post, globalSeo || {});
  const twitterImage = getTwitterImage(post, globalSeo || {});
  const noindex = Boolean(post.noindex);
  const nofollow = Boolean(post.nofollow);

  const metadata = {
    title,
    description,
    keywords: cleanString(post.meta_keywords)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    robots: {
      index: !noindex,
      follow: !nofollow,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: cleanString(post.og_title) || title,
      description: cleanString(post.og_description) || description,
      url: canonicalUrl,
      siteName: cleanString(globalSeo?.site_name) || "Sovereign Park",
      type: "article",
      publishedTime: post.published_at
        ? new Date(post.published_at).toISOString()
        : undefined,
      modifiedTime: post.updatedAt
        ? new Date(post.updatedAt).toISOString()
        : undefined,
      authors: post.author_name ? [post.author_name] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: cleanString(post.twitter_title) || cleanString(post.og_title) || title,
      description:
        cleanString(post.twitter_description) ||
        cleanString(post.og_description) ||
        description,
    },
  };

  if (openGraphImage) {
    metadata.openGraph.images = [
      {
        url: openGraphImage,
      },
    ];
  }

  if (twitterImage) {
    metadata.twitter.images = [twitterImage];
  }

  return metadata;
}

export default async function BlogSinglePage({ params }) {
  const resolvedParams = await params;
  const slug = cleanString(resolvedParams?.slug);
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const [recentPosts, globalSeo] = await Promise.all([
    getRecentPosts(post),
    SeoGlobalSetting.findOne({}).lean(),
  ]);

  const canonicalUrl = getBlogUrl(post, globalSeo || {});
  const image = getOpenGraphImage(post, globalSeo || {});
  const sanitizedContent = sanitizeHtml(post.content);

  const schema = post.schema_json || {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: getDescription(post),
    image: image ? [image] : undefined,
    datePublished: post.published_at
      ? new Date(post.published_at).toISOString()
      : undefined,
    dateModified: post.updatedAt
      ? new Date(post.updatedAt).toISOString()
      : undefined,
    author: post.author_name
      ? {
          "@type": "Person",
          name: post.author_name,
        }
      : undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-[#f7f9fc]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(schema),
          }}
        />

        {/* <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Link
              href="/blog"
              className="inline-flex border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              ← Back to Blog
            </Link>
          </div>
        </section> */}

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:px-8">
          <article className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
            {post.featured_image && (
              <div className="border-b border-slate-200 bg-slate-100">
                <img
                  src={post.featured_image}
                  alt={post.featured_image_alt || post.title}
                  className="max-h-[560px] w-full object-cover"
                />
              </div>
            )}

            <div className="px-5 py-8 sm:px-8 lg:px-10">
              <h1 className="break-words text-[26px] font-black leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                {post.title}
              </h1>

              <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-slate-200 py-4 text-[11px] font-black uppercase tracking-wide text-slate-500">
                {post.category && (
                  <span className="border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">
                    {post.category}
                  </span>
                )}
                <span>{formatDate(post.published_at)}</span>
                <span className="text-slate-300">•</span>
                <span>{post.reading_time_minutes || 1} min read</span>
                {post.author_name && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>{post.author_name}</span>
                  </>
                )}
              </div>

              <div
                className="blog-content mt-8 max-w-full overflow-hidden text-slate-700"
                dangerouslySetInnerHTML={{
                  __html: sanitizedContent,
                }}
              />

              {Array.isArray(post.tags) && post.tags.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-slate-200 pt-6">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>

          <aside className="min-w-0 space-y-6">
            <div className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-24">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">
                  Latest
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Recent Posts
                </h2>
              </div>

              <div className="mt-5 space-y-4">
                {recentPosts.length === 0 ? (
                  <p className="border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                    No recent posts available.
                  </p>
                ) : (
                  recentPosts.map((recent) => (
                    <Link
                      key={String(recent._id)}
                      href={`/blog/${recent.slug}`}
                      className="group grid grid-cols-[74px_1fr] gap-3 border border-slate-100 p-2 transition hover:border-blue-100 hover:bg-blue-50/60 sm:grid-cols-[86px_1fr]"
                    >
                      {recent.featured_image ? (
                        <img
                          src={recent.featured_image}
                          alt={recent.featured_image_alt || recent.title}
                          className="h-16 w-full object-cover sm:h-20"
                        />
                      ) : (
                        <div className="flex h-20 w-full items-center justify-center bg-slate-100 text-[10px] font-black text-slate-400">
                          Blog
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black leading-snug text-slate-950 transition group-hover:text-blue-700">
                          {recent.title}
                        </p>
                        <p className="mt-2 text-[11px] font-bold text-slate-500">
                          {formatDate(recent.published_at)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <Link
                href="/blog"
                className="mt-5 inline-flex w-full justify-center border border-blue-600 bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700"
              >
                View All Posts
              </Link>
            </div>
          </aside>
        </section>

        <style
          dangerouslySetInnerHTML={{
            __html: `.blog-content {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 16px;
  line-height: 1.9;
}

.blog-content h1,
.blog-content h2,
.blog-content h3,
.blog-content h4 {
  margin: 2rem 0 1rem;
  color: #020617;
  font-weight: 900;
  line-height: 1.25;
}

.blog-content h1 {
  font-size: clamp(1.75rem, 5vw, 2.2rem);
}

.blog-content h2 {
  font-size: clamp(1.45rem, 4vw, 1.8rem);
}

.blog-content h3 {
  font-size: clamp(1.25rem, 3vw, 1.45rem);
}

.blog-content p {
  margin: 1rem 0;
  font-size: 16px;
}

.blog-content ul {
  margin: 1rem 0;
  padding-left: 1.5rem;
  list-style: disc;
}

.blog-content ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
  list-style: decimal;
}

.blog-content li {
  margin: 0.35rem 0;
}

.blog-content blockquote {
  margin: 1.5rem 0;
  border-left: 4px solid #2563eb;
  background: #eff6ff;
  padding: 1rem 1.25rem;
  color: #1e3a8a;
  font-weight: 600;
}

.blog-content a {
  color: #2563eb;
  font-weight: 700;
  text-decoration: underline;
}

.blog-content img {
  margin: 1.5rem 0;
  max-width: 100% !important;
  height: auto !important;
}

.blog-content .blog-editor-image-wrap {
  display: inline-block;
  max-width: 100% !important;
  height: auto !important;
  overflow: hidden !important;
}

.blog-content .blog-editor-image-wrap img {
  margin: 0;
  max-width: 100% !important;
  width: 100% !important;
  height: auto !important;
}

.blog-content iframe,
.blog-content video {
  max-width: 100% !important;
}

.blog-content table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.blog-content pre {
  overflow-x: auto;
  background: #0f172a;
  padding: 1rem;
  color: #f8fafc;
}`,
          }}
        />
      </main>

      <Footer />
    </>
  );
}
