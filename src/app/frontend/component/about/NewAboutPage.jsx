const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": "https://lightcoral-starling-547513.hostingersite.com/about/#aboutpage",
  url: "https://lightcoral-starling-547513.hostingersite.com/about/",
  name: "About Sovereign Parking",
  description:
    "Meet Bec, Lance and the family behind Sovereign Parking. Brisbane's family-run home for cruise terminal, airport, long-term and caravan parking, based in Pinkenba.",
  mainEntity: {
    "@type": "ParkingFacility",
    "@id": "https://lightcoral-starling-547513.hostingersite.com/#organization",
    name: "Sovereign Parking",
    alternateName: "Harris Road Cruise and Airport Parking",
    url: "https://lightcoral-starling-547513.hostingersite.com/",
    telephone: "+61468472757",
    email: "hello@lightcoral-starling-547513.hostingersite.com",
    foundingDate: "2025",
    address: {
      "@type": "PostalAddress",
      streetAddress: "9 Harris Road",
      addressLocality: "Pinkenba",
      addressRegion: "QLD",
      postalCode: "4008",
      addressCountry: "AU",
    },
    founder: [
      { "@type": "Person", name: "Bec" },
      { "@type": "Person", name: "Lance" },
    ],
    areaServed: {
      "@type": "City",
      name: "Brisbane",
    },
    knowsAbout: [
      "Cruise terminal parking",
      "Long-term airport parking",
      "Long-term car parking",
      "Caravan storage",
      "Boat storage",
    ],
  },
};

export default function NewAboutPage() {
  return (
    <div id="sp-about">
      {/* HERO */}
      <section className="about-hero" aria-labelledby="about-heading">
        <div className="about-hero-accent" aria-hidden="true" />
        <div className="about-hero-accent-2" aria-hidden="true" />

        <div className="container">
          <div className="about-hero-inner">
            <div>
              <span className="about-hero-label">
                About Our Family Run Business
              </span>

              <h1 id="about-heading">
                About <em>Sovereign Parking</em>
              </h1>

              <p className="about-hero-lede">
                Sovereign Parking is a family-run business based in Pinkenba,
                Brisbane, offering cruise terminal parking, long-term airport
                parking, long-term car parking, and caravan and boat storage.
                Founded in 2025 by Bec and Lance after one too many stressful
                cruise mornings, we're now trusted by 500+ Brisbane families
                and counting.
              </p>

              <div className="about-hero-meta">
                <div className="about-hero-meta-item">
                  <span className="about-hero-meta-dot" />
                  Family-owned
                </div>

                <div className="about-hero-meta-item">
                  <span className="about-hero-meta-dot" />
                  500+ five-star reviews
                </div>

                <div className="about-hero-meta-item">
                  <span className="about-hero-meta-dot" />
                  Based in Pinkenba, QLD
                </div>
              </div>
            </div>

            <div className="about-hero-photo-wrap">
              <div className="about-hero-photo">
                <img
                  src="https://lightcoral-starling-547513.hostingersite.com/wp-content/uploads/2026/06/560192814_17861656140487552_9120037727005593060_n.jpg"
                  alt="Bec and Lance, founders of Sovereign Parking in Brisbane"
                />
              </div>

              <div className="about-hero-photo-caption">
                <span>Bec &amp; Lance</span> &nbsp;·&nbsp; Founders
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STORY */}
      <section className="story" aria-labelledby="story-heading">
        <div className="container">
          <div className="story-inner">
            <h2 id="story-heading">
              A local family who saw a gap, and{" "}
              <em>built the better way themselves</em>
            </h2>

            <div className="story-body">
              <p>
                We're a local Brisbane family who decided to do something about
                cruise day stress instead of just complaining about it. After
                one too many chaotic cruise mornings and an unpleasant parking
                experience of our own, we knew there had to be a better way, so
                we built it ourselves.
              </p>

              <p>
                Sovereign Parking opened in 2025 at 9 Harris Road in Pinkenba,
                just 4km from the Brisbane International Cruise Terminal and 10
                minutes from Brisbane Airport. From day one, the goal was
                simple: the kind of parking experience we'd want for our own
                family.
              </p>

              <blockquote className="story-pullquote">
                That's why if you haven't arrived by a certain time, we'll
                personally call to make sure everything's okay. And while
                you're off enjoying your cruise, our boys will even give your
                car a wash before you return. That's the kind of care only a
                family-run business can offer.
              </blockquote>

              <p>
                What started as a fix for cruise parking has grown into a
                parking and storage facility now trusted by 500+ Brisbane
                families, FIFO workers, caravan owners, and travellers heading
                off for weeks at a time. The four services we offer today:
                cruise terminal parking, long-term airport parking, long-term
                car parking, and caravan and boat storage, all run on the same
                principle that started us. Treat every car, caravan, and
                customer the way we'd want our own treated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="what-we-do" aria-labelledby="services-heading">
        <div className="container">
          <div className="wwd-header">
            <h2 id="services-heading">What we do today</h2>
            <p>
              From cruise day drop-offs to season-long caravan storage,
              Sovereign covers four core services from one secure Pinkenba
              facility.
            </p>
          </div>

          <div className="wwd-list">
            <div className="wwd-item">
              <div className="wwd-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
                </svg>
              </div>

              <div className="wwd-text">
                <h3>
                  <a href="/booking/cruise">Cruise terminal parking</a>
                </h3>
                <p>
                  The original Sovereign service. Secure parking 4km from BICT
                  with free shuttle, and a hand-wash from our boys before you
                  return.
                </p>
              </div>
            </div>

            <div className="wwd-item">
              <div className="wwd-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                </svg>
              </div>

              <div className="wwd-text">
                <h3>
                  <a href="/booking/airport">Long-term airport parking</a>
                </h3>
                <p>
                  Off-airport parking 10 minutes from BNE, ideal for week-plus
                  trips. Lower cost than on-airport with the same peace of
                  mind.
                </p>
              </div>
            </div>

            <div className="wwd-item">
              <div className="wwd-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                </svg>
              </div>

              <div className="wwd-text">
                <h3>
                  <a href="/booking/storage">Long-term car parking</a>
                </h3>
                <p>
                  Secure parking for FIFO workers, overseas trips, or anyone
                  leaving their car for weeks or months at a time.
                </p>
              </div>
            </div>

            <div className="wwd-item">
              <div className="wwd-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M21 11.5V8c0-1.1-.9-2-2-2h-3V4H4c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-3.5l-1-3zM7 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm10 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-1-6.5V8h3l1.5 4H16z" />
                </svg>
              </div>

              <div className="wwd-text">
                <h3>
                  <a href="/booking/storage">Caravan &amp; boat storage</a>
                </h3>
                <p>
                  Secure outdoor storage for caravans, boats, trailers and
                  motorhomes. Built for Queensland's grey-nomad season.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="why-us" aria-labelledby="why-us-heading">
        <div className="container">
          <div className="why-us-header">
            <h2 id="why-us-heading">
              Why Brisbane families choose Sovereign
            </h2>
            <p>The proof points behind the family-run promise.</p>
          </div>

          <div className="proof-grid">
            <div className="proof-card">
              <div className="proof-number">500+</div>
              <h3>Five-Star Reviews</h3>
              <p>
                Real Google Reviews from real Brisbane customers, kept current.
              </p>
            </div>

            <div className="proof-card">
              <div className="proof-number">4km</div>
              <h3>From BICT</h3>
              <p>
                Just 4km from the Brisbane International Cruise Terminal.
              </p>
            </div>

            <div className="proof-card">
              <div className="proof-number">24/7</div>
              <h3>Monitored Security</h3>
              <p>
                HD cameras, secure perimeter fencing, and round-the-clock
                monitoring.
              </p>
            </div>

            <div className="proof-card">
              <div className="proof-number">100%</div>
              <h3>Family-Run</h3>
              <p>
                From the welfare call if you're running late to the personal
                hand-wash before you return.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PROMISE */}
      <section className="promise" aria-labelledby="promise-heading">
        <div className="promise-bg" aria-hidden="true" />

        <div className="container">
          <div className="promise-inner">
            <p className="promise-label">Our promise</p>

            <h2 id="promise-heading">
              What you can expect when you book with us
            </h2>

            <ul className="promise-list">
              <li>
                <span className="promise-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
                <span>
                  A personal phone call if you haven't arrived by your expected
                  time, just to make sure everything's okay.
                </span>
              </li>

              <li>
                <span className="promise-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
                <span>
                  A car park that's secure, clean, and exactly where we said it
                  would be. No nasty surprises on arrival.
                </span>
              </li>

              <li>
                <span className="promise-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
                <span>
                  For cruise customers, a free shuttle that runs on time and a
                  hand-wash from our boys before you return.
                </span>
              </li>

              <li>
                <span className="promise-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
                <span>
                  Clear pricing and refund terms, with everything you need to
                  know up front before you book.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta" aria-labelledby="cta-heading">
        <div className="container">
          <h2 id="cta-heading">
            Ready to park with people who actually care?
          </h2>

          <p>
            Book your cruise parking online in minutes, or give us a call about
            airport, long-term or caravan storage.
          </p>

          <div className="about-cta-group">
            <a href="/booking/cruise" className="btn btn-pink btn-xl">
              Book Cruise Parking
            </a>

            <a href="tel:+61468472757" className="btn btn-outline btn-xl">
              Call 0468 472 757
            </a>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(aboutSchema),
        }}
      />
    </div>
  );
}
