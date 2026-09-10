"use client";

import Script from "next/script";

const servicesSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id":
    "https://lightcoral-starling-547513.hostingersite.com/services/#collectionpage",
  url: "https://lightcoral-starling-547513.hostingersite.com/services/",
  name: "Our Services | Sovereign Parking Brisbane",
  description:
    "Cruise terminal parking, long-term airport parking, long-term car parking, and caravan and boat storage at Sovereign Parking in Pinkenba, Brisbane.",
  isPartOf: {
    "@type": "WebSite",
    url: "https://lightcoral-starling-547513.hostingersite.com/",
  },
  about: {
    "@type": "ParkingFacility",
    "@id":
      "https://lightcoral-starling-547513.hostingersite.com/#organization",
    name: "Sovereign Parking",
  },
  hasPart: [
    {
      "@type": "Service",
      name: "Cruise Terminal Parking Brisbane",
      url: "https://lightcoral-starling-547513.hostingersite.com/",
      description:
        "Secure parking 4km from Brisbane International Cruise Terminal with free shuttle and hand-wash on return.",
    },
    {
      "@type": "Service",
      name: "Long-Term Airport Parking Brisbane",
      url:
        "https://lightcoral-starling-547513.hostingersite.com/services/long-term-airport-parking-brisbane/",
      description:
        "Off-airport long-term parking 10 minutes from Brisbane Airport (BNE).",
    },
    {
      "@type": "Service",
      name: "Long-Term Parking",
      url:
        "https://lightcoral-starling-547513.hostingersite.com/services/long-term-parking/",
      description:
        "Secure long-term parking in Pinkenba for FIFO workers, overseas travellers, and extended stays.",
    },
    {
      "@type": "Service",
      name: "Caravan and Boat Storage Brisbane",
      url:
        "https://lightcoral-starling-547513.hostingersite.com/services/caravan-storage-brisbane/",
      description:
        "Secure outdoor storage for caravans, boats, trailers and motorhomes at our Pinkenba facility.",
    },
    {
      "@type": "Service",
      name: "Car Storage Brisbane",
      url:
        "https://lightcoral-starling-547513.hostingersite.com/services/car-storage-brisbane/",
      description:
        "Ongoing secure car storage in Pinkenba for second vehicles, classic cars, and vehicles not in daily use.",
    },
  ],
};

const LocationIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.58l2.2-2.21c.28-.27.36-.66.25-1.01C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

export default function NewServicesPage() {
  const scrollToSection = (event, sectionId) => {
    event.preventDefault();

    const target = document.getElementById(sectionId);

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.history.replaceState(null, "", `#${sectionId}`);
  };

  return (
    <div id="sp-services">
      {/* HERO */}
      <section
        className="services-hero"
        aria-labelledby="services-heading"
      >
        <div
          className="services-hero-accent"
          aria-hidden="true"
        />

        <div
          className="services-hero-accent-2"
          aria-hidden="true"
        />

        <div className="container">
          <div className="services-hero-inner">
            <span className="services-hero-label">
              Our Services
            </span>

            <h1 id="services-heading">
              Brisbane parking and vehicle storage,{" "}
              <em>sorted</em>
            </h1>

            <p className="services-hero-sub">
              Four services, one secure family-run facility in
              Pinkenba. Whether you're cruising, flying, or storing
              your caravan for the season : pick the option that fits
              and we'll take it from there.
            </p>

            <nav
              className="services-hero-quick-nav"
              aria-label="Jump to service"
            >
              <a
                href="#cruise"
                onClick={(e) =>
                  scrollToSection(e, "cruise")
                }
              >
                Cruise terminal
              </a>

              <a
                href="#airport"
                onClick={(e) =>
                  scrollToSection(e, "airport")
                }
              >
                Airport parking
              </a>

              <a
                href="#long-term"
                onClick={(e) =>
                  scrollToSection(e, "long-term")
                }
              >
                Long-term parking
              </a>

              <a
                href="#car-storage"
                onClick={(e) =>
                  scrollToSection(e, "car-storage")
                }
              >
                Car storage
              </a>

              <a
                href="#caravan"
                onClick={(e) =>
                  scrollToSection(e, "caravan")
                }
              >
                Caravan storage
              </a>
            </nav>
          </div>
        </div>
      </section>

      {/* SERVICE CARDS */}
      <section
        className="service-list"
        aria-labelledby="service-list-heading"
      >
        <div className="container">
          <div className="section-header">
            <p className="section-label">
              Pick Your Service
            </p>

            <h2
              id="service-list-heading"
              className="section-title"
            >
              Choose how we can help
            </h2>

            <p className="section-desc">
              Each service has its own dedicated page with full
              details, pricing where applicable, and a direct path to
              book or enquire.
            </p>
          </div>

          <div className="service-list-grid">
            {/* CRUISE */}
            <article
              className="svc-card"
              id="cruise"
            >
              <div className="svc-card-img">
                <span className="svc-card-tag">
                  Most Popular
                </span>

                <img
                  src="https://lightcoral-starling-547513.hostingersite.com/wp-content/uploads/2026/03/Sovereign-Parking-Brisbane-International-Cruise-Terminal.jpeg"
                  alt="Sovereign Parking cruise terminal parking facility in Pinkenba, Brisbane"
                  loading="lazy"
                />
              </div>

              <div className="svc-card-content">
                <h3>Cruise Terminal Parking</h3>

                <p className="svc-card-summary">
                  Secure parking just 4km from the Brisbane
                  International Cruise Terminal, with free shuttle
                  transfers and a hand-wash from our boys before you
                  return. The original Sovereign service.
                </p>

                <div className="svc-card-meta">
                  <div className="svc-card-meta-item">
                    <LocationIcon />
                    <span>
                      <strong>4km</strong> to BICT
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <UserIcon />
                    <span>
                      <strong>For cruisers</strong>
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <ShieldIcon />
                    <span>
                      <strong>24/7</strong> monitored
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <CalendarIcon />
                    <span>
                      <strong>Book online</strong>
                    </span>
                  </div>
                </div>

                <div className="svc-card-actions">
                  <a
                    href="/"
                    className="btn btn-outline btn-lg"
                  >
                    Learn more
                  </a>

                  <a
                    href="/booking/cruise"
                    className="btn btn-pink btn-lg"
                  >
                    Book now
                  </a>
                </div>
              </div>
            </article>

            {/* AIRPORT */}
            <article
              className="svc-card"
              id="airport"
            >
              <div className="svc-card-img">
                <span className="svc-card-tag tag-blue">
                  Airport
                </span>

                <img
                  src="https://lightcoral-starling-547513.hostingersite.com/wp-content/uploads/2026/01/Sovereign-Parking-Brisbane-Cruise-Terminal-Parking-Site.webp"
                  alt="Long-term airport parking near Brisbane Airport at Sovereign Parking"
                  loading="lazy"
                />
              </div>

              <div className="svc-card-content">
                <h3>Long-Term Airport Parking</h3>

                <p className="svc-card-summary">
                  Off-airport parking just 10 minutes from Brisbane
                  Airport (BNE) Domestic and International. A secure
                  alternative for week-plus trips, with the same
                  family-run care.
                </p>

                <div className="svc-card-meta">
                  <div className="svc-card-meta-item">
                    <LocationIcon />
                    <span>
                      <strong>10 min</strong> to BNE
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <UserIcon />
                    <span>
                      <strong>For flyers</strong>
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <ShieldIcon />
                    <span>
                      <strong>24/7</strong> monitored
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <PhoneIcon />
                    <span>
                      <strong>Call to enquire</strong>
                    </span>
                  </div>
                </div>

                <div className="svc-card-actions">
                  <a
                    href="/booking/airport"
                    className="btn btn-outline btn-lg"
                  >
                    Learn more
                  </a>

                  <a
                    href="tel:+61468472757"
                    className="btn btn-pink btn-lg"
                  >
                    Call to enquire
                  </a>
                </div>
              </div>
            </article>

            {/* LONG TERM */}
            <article
              className="svc-card"
              id="long-term"
            >
              <div className="svc-card-img">
                <span className="svc-card-tag tag-blue">
                  Long Term
                </span>

                <img
                  src="https://lightcoral-starling-547513.hostingersite.com/wp-content/uploads/2026/01/Sovereign-Parking-Brisbane-Cruise-Terminal-Parking-Lot.png"
                  alt="Long-term car parking and storage in Pinkenba at Sovereign Parking"
                  loading="lazy"
                />
              </div>

              <div className="svc-card-content">
                <h3>Long-Term Parking</h3>

                <p className="svc-card-summary">
                  For when life takes you away for weeks or months :
                  FIFO rotations, overseas trips, extended holidays.
                  Your car waits safely until you're back.
                </p>

                <div className="svc-card-meta">
                  <div className="svc-card-meta-item">
                    <LocationIcon />
                    <span>
                      <strong>Pinkenba</strong> site
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <UserIcon />
                    <span>
                      <strong>FIFO &amp; overseas</strong>
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <ShieldIcon />
                    <span>
                      <strong>24/7</strong> monitored
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <PhoneIcon />
                    <span>
                      <strong>Call to enquire</strong>
                    </span>
                  </div>
                </div>

                <div className="svc-card-actions">
                  <a
                    href="/services/long-term-parking/"
                    className="btn btn-outline btn-lg"
                  >
                    Learn more
                  </a>

                  <a
                    href="tel:+61468472757"
                    className="btn btn-pink btn-lg"
                  >
                    Call to enquire
                  </a>
                </div>
              </div>
            </article>

            {/* CARAVAN */}
            <article
              className="svc-card"
              id="caravan"
            >
              <div className="svc-card-img">
                <span className="svc-card-tag tag-blue">
                  Storage
                </span>

                <img
                  src="https://lightcoral-starling-547513.hostingersite.com/wp-content/uploads/2025/09/094A3638-scaled.jpg"
                  alt="Caravan and boat storage at Sovereign Parking in Pinkenba, Brisbane"
                  loading="lazy"
                />
              </div>

              <div className="svc-card-content">
                <h3>
                  Caravan &amp; Boat Storage
                </h3>

                <p className="svc-card-summary">
                  Secure outdoor storage for caravans, boats,
                  trailers and motorhomes. Built for Queensland's
                  grey-nomad season, with month-on-month or seasonal
                  arrangements available.
                </p>

                <div className="svc-card-meta">
                  <div className="svc-card-meta-item">
                    <LocationIcon />
                    <span>
                      <strong>Pinkenba</strong> site
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <UserIcon />
                    <span>
                      <strong>
                        For van &amp; boat owners
                      </strong>
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <ShieldIcon />
                    <span>
                      <strong>24/7</strong> monitored
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <PhoneIcon />
                    <span>
                      <strong>Call to enquire</strong>
                    </span>
                  </div>
                </div>

                <div className="svc-card-actions">
                  <a
                    href="/booking/storage"
                    className="btn btn-outline btn-lg"
                  >
                    Learn more
                  </a>

                  <a
                    href="tel:+61468472757"
                    className="btn btn-pink btn-lg"
                  >
                    Call to enquire
                  </a>
                </div>
              </div>
            </article>

            {/* CAR STORAGE */}
            <article
              className="svc-card"
              id="car-storage"
            >
              <div className="svc-card-img">
                <span className="svc-card-tag tag-blue">
                  Storage
                </span>

                <img
                  src="https://lightcoral-starling-547513.hostingersite.com/wp-content/uploads/2025/09/094A3512-scaled.jpg"
                  alt="Car storage facility at Sovereign Parking in Pinkenba, Brisbane"
                  loading="lazy"
                />
              </div>

              <div className="svc-card-content">
                <h3>Car Storage</h3>

                <p className="svc-card-summary">
                  A permanent home for vehicles you don't drive every
                  day. Classic cars, second vehicles, or anything
                  that needs to live somewhere safer than the street.
                </p>

                <div className="svc-card-meta">
                  <div className="svc-card-meta-item">
                    <LocationIcon />
                    <span>
                      <strong>Pinkenba</strong> site
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <UserIcon />
                    <span>
                      <strong>
                        For 2nd cars &amp; classics
                      </strong>
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <ShieldIcon />
                    <span>
                      <strong>24/7</strong> monitored
                    </span>
                  </div>

                  <div className="svc-card-meta-item">
                    <PhoneIcon />
                    <span>
                      <strong>Call to enquire</strong>
                    </span>
                  </div>
                </div>

                <div className="svc-card-actions">
                  <a
                    href="/booking/storage"
                    className="btn btn-outline btn-lg"
                  >
                    Learn more
                  </a>

                  <a
                    href="tel:+61468472757"
                    className="btn btn-pink btn-lg"
                  >
                    Call to enquire
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* DECISION HELPER */}
      <section
        className="decision"
        aria-labelledby="decision-heading"
      >
        <div className="container">
          <div className="section-header">
            <p className="section-label">
              Not sure which?
            </p>

            <h2
              id="decision-heading"
              className="section-title"
            >
              Which service do I need?
            </h2>

            <p className="section-desc">
              Quick prompts to point you at the right option in under
              a minute.
            </p>
          </div>

          <div className="decision-grid">
            <a
              href="#cruise"
              className="decision-card"
              onClick={(e) =>
                scrollToSection(e, "cruise")
              }
            >
              <p className="decision-card-prompt">
                If you're...
              </p>

              <h3>
                Catching a cruise from Brisbane
              </h3>

              <p>
                You need cruise terminal parking. Drop off on your
                cruise day, free shuttle to BICT, washed car on your
                return.
              </p>

              <span className="decision-card-link">
                See cruise parking
                <ArrowIcon />
              </span>
            </a>

            <a
              href="#airport"
              className="decision-card"
              onClick={(e) =>
                scrollToSection(e, "airport")
              }
            >
              <p className="decision-card-prompt">
                If you're...
              </p>

              <h3>
                Flying out for a week or more
              </h3>

              <p>
                Long-term airport parking is for you. 10 minutes from
                BNE, lower cost than on-airport for longer stays.
              </p>

              <span className="decision-card-link">
                See airport parking
                <ArrowIcon />
              </span>
            </a>

            <a
              href="#long-term"
              className="decision-card"
              onClick={(e) =>
                scrollToSection(e, "long-term")
              }
            >
              <p className="decision-card-prompt">
                If you're...
              </p>

              <h3>
                Working FIFO or away overseas
              </h3>

              <p>
                Long-term car parking covers extended stays for cars
                sitting safely off-street while you're working away.
              </p>

              <span className="decision-card-link">
                See long-term parking
                <ArrowIcon />
              </span>
            </a>

            <a
              href="#caravan"
              className="decision-card"
              onClick={(e) =>
                scrollToSection(e, "caravan")
              }
            >
              <p className="decision-card-prompt">
                If you're...
              </p>

              <h3>
                Storing a caravan, boat or trailer
              </h3>

              <p>
                Caravan and boat storage is built for the off-season,
                between trips, or anywhere you need a secure home for
                a larger vehicle.
              </p>

              <span className="decision-card-link">
                See caravan storage
                <ArrowIcon />
              </span>
            </a>

            <a
              href="#car-storage"
              className="decision-card"
              onClick={(e) =>
                scrollToSection(e, "car-storage")
              }
            >
              <p className="decision-card-prompt">
                If you're...
              </p>

              <h3>
                Storing a car you don't drive often
              </h3>

              <p>
                Car storage gives a permanent home to second cars,
                classic cars, or anything that's safer off the street
                long-term.
              </p>

              <span className="decision-card-link">
                See car storage
                <ArrowIcon />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* COMMON TO ALL */}
      <section
        className="common"
        aria-labelledby="common-heading"
      >
        <div className="container">
          <div className="section-header">
            <p className="section-label">
              Across Every Service
            </p>

            <h2
              id="common-heading"
              className="section-title"
            >
              What you get with Sovereign
            </h2>

            <p className="section-desc">
              The standards that carry through every booking,
              regardless of which service you pick.
            </p>
          </div>

          <div className="common-grid">
            <div className="common-item">
              <div className="common-icon">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </div>

              <h3>Secure facility</h3>

              <p>
                HD cameras, perimeter fencing, and 24/7 monitoring
                across the whole Pinkenba site.
              </p>
            </div>

            <div className="common-item">
              <div className="common-icon">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </div>

              <h3>Family-run care</h3>

              <p>
                A welfare call if you're running late, and personal
                touches no big operator can match.
              </p>
            </div>

            <div className="common-item">
              <div className="common-icon">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                </svg>
              </div>

              <h3>One Pinkenba site</h3>

              <p>
                9 Harris Road : 4km from the cruise terminal, 10
                minutes from Brisbane Airport.
              </p>
            </div>

            <div className="common-item">
              <div className="common-icon">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </div>

              <h3>
                500+ five-star reviews
              </h3>

              <p>
                The track record built on Google by real Brisbane
                customers, kept current.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section
        className="social-proof"
        aria-labelledby="reviews-heading"
      >
        <div className="container">
          <div className="reviews-header">
            <div>
              <p className="section-label">
                500+ Five-Star Reviews
              </p>

              <h2
                id="reviews-heading"
                className="section-title"
              >
                Hear From Our Happy Customers
              </h2>
            </div>

            <a
              href="https://share.google/CqbA01BiTy18wVkwY"
              target="_blank"
              rel="noopener noreferrer"
              className="review-aggregate"
              aria-label="Read our 500+ five-star Google Reviews (opens in a new tab)"
            >
              <div
                className="review-score"
                aria-hidden="true"
              >
                5.0
              </div>

              <div className="review-meta">
                <div
                  className="stars"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <p>
                  <strong className="review-count">
                    500+
                  </strong>{" "}
                  Google Reviews

                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="external-link-icon"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line
                      x1="10"
                      y1="14"
                      x2="21"
                      y2="3"
                    />
                  </svg>
                </p>
              </div>
            </a>
          </div>

          <div className="carousel-wrap">
            <Script
              src="https://elfsightcdn.com/platform.js"
              strategy="afterInteractive"
            />

            <div
              className="elfsight-app-afd87c6e-5269-4b1b-a851-fc44e84bf48d"
              data-elfsight-app-lazy=""
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="services-cta"
        aria-labelledby="cta-heading"
      >
        <div
          className="services-cta-accent"
          aria-hidden="true"
        />

        <div className="container">
          <div className="services-cta-inner">
            <h2 id="cta-heading">
              Still not sure which service fits?
            </h2>

            <p>
              Give us a call and we'll point you in the right
              direction. No pressure, no upsell, just a quick chat to
              find the right option for your trip or storage need.
            </p>

            <div className="services-cta-group">
              <a
                href="tel:+61468472757"
                className="btn btn-white btn-xl"
              >
                Call 0468 472 757
              </a>

              <a
                href="/booking/cruise"
                className="btn btn-ghost btn-xl"
              >
                Book Cruise Parking
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(servicesSchema),
        }}
      />
    </div>
  );
}