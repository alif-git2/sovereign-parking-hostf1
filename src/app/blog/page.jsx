import Link from "next/link";
import mongoose from "mongoose";
import Navbar from "@/app/frontend/component/global/NavBar";
import Footer from "@/app/frontend/component/global/Footer";
import BlogPost from "@/app/backend/models/blogPost";
import {
  getSeoMetadata,
  getSeoSchemaJson,
} from "@/app/backend/utils/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSTS_PER_PAGE = 9;

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

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExcerpt(post) {
  const excerpt = stripHtml(post.excerpt);

  if (excerpt) return excerpt;

  return stripHtml(post.content).slice(0, 160);
}

async function getPublishedPosts(page = 1) {
  await connectToDatabase();

  const safePage = Math.max(1, Number(page || 1));
  const skip = (safePage - 1) * POSTS_PER_PAGE;

  const query = {
    status: "published",
  };

  const [posts, total] = await Promise.all([
    BlogPost.find(query)
      .sort({
        is_featured: -1,
        published_at: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .lean(),
    BlogPost.countDocuments(query),
  ]);

  return {
    posts,
    pagination: {
      page: safePage,
      total,
      totalPages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
    },
  };
}

export async function generateMetadata() {
  return getSeoMetadata("/blog");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function BlogPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams?.page || 1);
  const [{ posts, pagination }, schemaJson] = await Promise.all([
    getPublishedPosts(page),
    getSeoSchemaJson("/blog"),
  ]);

  return (
    <>
      {schemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(schemaJson),
          }}
        />
      )}

      <Navbar />

      <main className="min-h-screen bg-[#f7f9fc]">
        <section className="border-b border-slate-200 bg-white">
          {/* <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="max-w-3xl border-l-4 border-blue-600 pl-6">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">
                Sovereign Park Insights
              </p>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Parking Guides & Travel Tips
              </h1>

              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                Helpful articles about cruise parking, airport parking, storage
                parking, and smarter booking decisions.
              </p>
            </div>
          </div> */}
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="border border-slate-200 bg-white p-10 text-center shadow-sm">
              <h2 className="text-xl font-black text-slate-950">
                No blog posts found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Published blog posts will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article
                  key={String(post._id)}
                  className="group border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <Link href={`/blog/${post.slug}`} className="block">
                    {post.featured_image ? (
                      <img
                        src={post.featured_image}
                        alt={post.featured_image_alt || post.title}
                        className="h-56 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-56 w-full items-center justify-center bg-slate-100 text-sm font-bold text-slate-400">
                        Sovereign Park
                      </div>
                    )}
                  </Link>

                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                      {post.category && (
                        <span className="border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-700">
                          {post.category}
                        </span>
                      )}
                      <span>{formatDate(post.published_at)}</span>
                      <span>·</span>
                      <span>{post.reading_time_minutes || 1} min read</span>
                    </div>

                    <h2 className="mt-4 line-clamp-2 text-xl font-black leading-snug text-slate-950 transition group-hover:text-blue-700">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>

                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">
                      {getExcerpt(post)}
                    </p>

                    <Link
                      href={`/blog/${post.slug}`}
                      className="mt-6 inline-flex border border-blue-600 bg-blue-600 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700"
                    >
                      Read More
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              {pagination.page > 1 && (
                <Link
                  href={`/blog?page=${pagination.page - 1}`}
                  className="border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
                >
                  Previous
                </Link>
              )}

              <span className="border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              {pagination.page < pagination.totalPages && (
                <Link
                  href={`/blog?page=${pagination.page + 1}`}
                  className="border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}
