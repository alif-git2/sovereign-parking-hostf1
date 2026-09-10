"use client";

import { useEffect } from "react";
import Script from "next/script";

export default function NewHomePage() {
  useEffect(() => {
    const spRoot = document.getElementById("sp-page");
    if (!spRoot) return undefined;

    const handleAccordionClick = (event) => {
      const btn = event.target.closest(".accordion-btn");
      if (!btn || !spRoot.contains(btn)) return;

      const expanded = btn.getAttribute("aria-expanded") === "true";

      spRoot.querySelectorAll(".accordion-btn").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
        const targetId = button.getAttribute("aria-controls");
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) target.classList.remove("open");
      });

      if (!expanded) {
        btn.setAttribute("aria-expanded", "true");
        const targetId = btn.getAttribute("aria-controls");
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) target.classList.add("open");
      }
    };

    spRoot.addEventListener("click", handleAccordionClick);

    const animatedElements = spRoot.querySelectorAll(
      ".why-card, .faq-item, .service-card"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    animatedElements.forEach((element) => {
      element.style.opacity = "0";
      element.style.transform = "translateY(16px)";
      element.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      observer.observe(element);
    });

    return () => {
      spRoot.removeEventListener("click", handleAccordionClick);
      observer.disconnect();
    };
  }, []);

  return (
<div id="sp-page">
    <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-accent" aria-hidden="true"></div>
        <div className="hero-accent-2" aria-hidden="true"></div>
        <div className="container">
          <div className="hero-inner">
            <div className="hero-content">
              <h1 id="hero-heading">
                Cruise Terminal Parking <em>Brisbane</em>
              </h1>
              <p className="hero-desc">
                Secure cruise terminal parking just 4km from BICT, with free shuttle transfers, 24/7 monitored security and a complimentary car wash on return. Brisbane's family-run home for cruise, airport, long-term and caravan parking.
              </p>
              <div className="hero-cta-group">
                <a href="/booking/cruise" className="btn btn-pink btn-xl" aria-label="Book your cruise terminal parking">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Book Your Spot
                </a>
                <a href="tel:+61468472757" className="btn btn-ghost btn-xl" aria-label="Call us on 0468 472 757">Call 0468 472 757</a>
              </div>
              <div className="hero-trust">
                <div className="hero-stars" aria-label="5 star rating">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
                <a href="https://share.google/CqbA01BiTy18wVkwY" target="_blank" rel="noopener" className="hero-trust-text" style={{ textDecoration: "underline", textUnderlineOffset: "3px", textDecorationColor: "rgba(255,255,255,0.3)" }}><strong>Trusted by 500+ Brisbane travellers</strong> with 5-star Google Reviews</a>
              </div>
            </div>
    
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-card">
                <div className="hero-card-img">
                  <img src="/images/Sovereign-Parking-Brisbane-Cruise-Terminal-Parking-Site.webp" alt="Sovereign Parking facility near Brisbane International Cruise Terminal" />
                </div>
                <div className="hero-badges">
                  <div className="hero-badge">
                    <div className="hero-badge-icon">
    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
                    </div>
                    <div className="hero-badge-text"><strong>4km Away</strong>From BICT</div>
                  </div>
                  <div className="hero-badge">
                    <div className="hero-badge-icon">
    <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                    </div>
                    <div className="hero-badge-text"><strong>24/7</strong>Monitored</div>
                  </div>
                  <div className="hero-badge">
                    <div className="hero-badge-icon">
    <svg viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 11H6V6h12v5z"/></svg>
                    </div>
                    <div className="hero-badge-text"><strong>Free Shuttle</strong>Both Ways</div>
                  </div>
                  <div className="hero-badge">
                    <div className="hero-badge-icon">
    <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-9 7l-2.5-2.5L8.91 11l1.09 1.09L13.09 9 14.5 10.41 10 15z"/></svg>
                    </div>
                    <div className="hero-badge-text"><strong>Book Online</strong>Pay On Arrival</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    <section className="how-it-works" id="how-it-works" aria-labelledby="hiw-heading">
        <div className="container">
          <div className="hiw-header">
            <p className="section-label">Simple Process</p>
            <h2 id="hiw-heading" className="section-title">How Cruise Terminal Parking Works</h2>
            <p className="section-desc">From booking to boarding, we handle every step so you can focus on your cruise.</p>
          </div>
          <div className="hiw-steps">
            <div className="hiw-connector" aria-hidden="true">
              <div className="hiw-connector-line left"></div>
              <div className="hiw-connector-line right"></div>
            </div>
    
            <div className="hiw-step">
              <div className="hiw-step-number" aria-hidden="true">1</div>
              <h3>Book Online in Minutes</h3>
              <p>Select your cruise departure date, confirm your booking and prepay securely. A confirmation lands in your inbox straight away.</p>
              <span className="hiw-tag">Takes under 2 minutes</span>
            </div>
    
            <div className="hiw-step">
              <div className="hiw-step-number" aria-hidden="true">2</div>
              <h3>Arrive and Hand Over Your Keys</h3>
              <p>Drive in on your cruise day. Our team takes your keys, parks your vehicle, loads your bags and shuttles you directly to BICT.</p>
              <span className="hiw-tag">5–10 min to terminal</span>
            </div>
    
            <div className="hiw-step">
              <div className="hiw-step-number" aria-hidden="true">3</div>
              <h3>Return to a Clean Car</h3>
              <p>Catch the shuttle back from the cruise terminal. Your car will be freshly hand-washed, with the air-con running on a hot Queensland day.</p>
              <span className="hiw-tag">Car wash included</span>
            </div>
          </div>
        </div>
      </section>
    <section className="intro" id="intro" aria-labelledby="intro-heading">
        <div className="container">
          <div className="intro-grid">
            <div className="intro-img-wrap">
              <div className="intro-img">
                <img src="/images/094A3560.webp" alt="Sovereign Parking near Brisbane International Cruise Terminal" />
              </div>
              <div className="intro-badge-float">
                <span>100%</span>
                Family-run &amp; trusted
              </div>
            </div>
    
            <div className="intro-content">
              <p className="section-label">Start Your Cruise the Right Way</p>
              <h2 id="intro-heading" className="section-title">Affordable BICT Parking, Just Minutes From Brisbane Cruise Terminal</h2>
              <p className="section-desc">We're a family-run business committed to making your travel and storage experience stress-free. Located just minutes from Brisbane International Cruise Terminal, we offer reliable cruise parking, airport parking, long-term parking and caravan storage, all at great rates with simple online booking.</p>
    
              <div style={{ marginTop: "32px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a href="/booking/cruise" className="btn btn-pink btn-lg">Book Cruise Parking</a>
                <a href="#services" className="btn btn-outline btn-lg">Explore All Services</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    <section className="services" id="services" aria-labelledby="services-heading">
        <div className="container">
          <div className="services-header">
            <p className="section-label">Our Services</p>
            <h2 id="services-heading" className="section-title">Brisbane Parking and Vehicle Storage, Sorted</h2>
            <p className="section-desc">From cruise day to caravan season, we've got Brisbane covered. Pick the service that suits your stay.</p>
          </div>
          <div className="services-grid">
    <a href="#how-it-works" className="service-card is-primary" aria-label="See how cruise terminal parking works">
              <div className="service-card-img">
                <svg viewBox="0 0 64 64" fill="none" stroke="#1c6de0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 44h48l-4 12H12l-4-12z"/>
                  <path d="M14 44V28h36v16"/>
                  <path d="M20 28V18h24v10"/>
                  <line x1="32" y1="18" x2="32" y2="10"/>
                  <circle cx="32" cy="36" r="2"/>
                </svg>
              </div>
              <div className="service-card-content">
                <span className="service-card-tag">Most Popular</span>
                <h3>Cruise Terminal Parking</h3>
                <p>Secure parking 4km from BICT with free shuttle, valet, and complimentary car wash on return. The original Sovereign service.</p>
                <span className="service-card-link">
                  See how it works
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </div>
            </a>
    <a href="/booking/airport" className="service-card" aria-label="Learn more about long-term airport parking in Brisbane">
              <div className="service-card-img">
                <svg viewBox="0 0 64 64" fill="none" stroke="#1c6de0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M55 32c0-1.5-1-2.5-2.5-2.5H42L31 14h-5l6 15.5H18l-4-5h-4l2 7-2 7h4l4-5h14L26 49h5l11-15.5h10.5C54 33.5 55 32.5 55 32z"/>
                </svg>
              </div>
              <div className="service-card-content">
                <span className="service-card-tag">Airport</span>
                <h3>Long-Term Airport Parking</h3>
                <p>Just 10 minutes from BNE Domestic and International. A genuine off-airport alternative for week-plus trips with secure long-term parking.</p>
                <span className="service-card-meta">Call to enquire</span>
                <span className="service-card-link">
                  Airport parking details
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </div>
            </a>
    <a href="/booking/storage" className="service-card" aria-label="Learn more about long-term car parking">
              <div className="service-card-img">
                <svg viewBox="0 0 64 64" fill="none" stroke="#1c6de0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="20" width="48" height="28" rx="3"/>
                  <circle cx="32" cy="32" r="6"/>
                  <line x1="32" y1="26" x2="32" y2="32"/>
                  <line x1="32" y1="32" x2="36" y2="34"/>
                  <line x1="14" y1="14" x2="14" y2="20"/>
                  <line x1="50" y1="14" x2="50" y2="20"/>
                </svg>
              </div>
              <div className="service-card-content">
                <span className="service-card-tag">Long Term</span>
                <h3>Long-Term Car Parking</h3>
                <p>Storing your car while overseas, FIFO, or away long-term? Secure car parking and storage in Pinkenba with 24/7 monitoring.</p>
                <span className="service-card-meta">Call to enquire</span>
                <span className="service-card-link">
                  Long-term parking details
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </div>
            </a>
    <a href="/booking/storage" className="service-card" aria-label="Learn more about caravan storage in Brisbane">
              <div className="service-card-img">
                <svg viewBox="0 0 64 64" fill="none" stroke="#1c6de0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="6" y="22" width="44" height="22" rx="3"/>
                  <circle cx="18" cy="48" r="4"/>
                  <circle cx="40" cy="48" r="4"/>
                  <line x1="50" y1="34" x2="58" y2="34"/>
                  <rect x="14" y="28" width="8" height="8"/>
                  <rect x="32" y="28" width="8" height="8"/>
                </svg>
              </div>
              <div className="service-card-content">
                <span className="service-card-tag">Storage</span>
                <h3>Caravan &amp; Boat Storage</h3>
                <p>Secure outdoor storage for caravans, boats, trailers and motorhomes in Brisbane's east. Perfect for QLD's grey-nomad season.</p>
                <span className="service-card-meta">Call to enquire</span>
                <span className="service-card-link">
                  Caravan storage details
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </div>
            </a>
    
          </div>
        </div>
      </section>
    <section className="why" id="why" aria-labelledby="why-heading">
        <div className="container">
          <div className="why-header">
            <p className="section-label">Why Choose Sovereign Parking</p>
            <h2 id="why-heading" className="section-title">Brisbane's Trusted Choice for Parking and Storage</h2>
            <p className="section-desc">Whether you're catching a cruise, a flight or storing your van for the season, we've designed every part of the experience around making it effortless.</p>
          </div>
          <div className="why-grid">
            <div className="why-card">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <h3>Complimentary Shuttle</h3>
              <p>Free return transfers for cruise customers directly to and from Brisbane International Cruise Terminal.</p>
            </div>
            <div className="why-card">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
              <h3>4km from BICT, 10 min to BNE</h3>
              <p>9 Harris Road, Pinkenba. An easy run to both the Brisbane Cruise Terminal and BNE Airport.</p>
            </div>
            <div className="why-card">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7v-5z"/></svg>
              </div>
              <h3>Book and Prepay Online</h3>
              <p>Reserve your spot in minutes. Pay online or on arrival. Your booking is confirmed instantly.</p>
            </div>
            <div className="why-card">
              <div className="why-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Secure 24HR Monitored</h3>
              <p>HD cameras, 24/7 monitoring, and secure perimeter fencing. Your vehicle, caravan or boat stays protected.</p>
            </div>
          </div>
        </div>
      </section>
    <section className="social-proof" id="reviews" aria-labelledby="reviews-heading">
        <div className="container">
          <div className="reviews-header">
            <div>
              <p className="section-label">500+ Five-Star Reviews</p>
              <h2 id="reviews-heading" className="section-title">Hear From Our Happy Customers</h2>
            </div>
            <a href="https://share.google/CqbA01BiTy18wVkwY" target="_blank" rel="noopener" className="review-aggregate" aria-label="Read our 500+ five-star Google Reviews (opens in a new tab)">
              <div className="review-score" aria-hidden="true">5.0</div>
              <div className="review-meta">
                <div className="stars" aria-hidden="true">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
                <p><strong style={{ color: "var(--text-dark)" }}>500+</strong> Google Reviews
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-1px", marginLeft: "3px" }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </p>
              </div>
            </a>
          </div>
    
          <div className="carousel-wrap">
    <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
            <div className="elfsight-app-afd87c6e-5269-4b1b-a851-fc44e84bf48d" data-elfsight-app-lazy></div>
          </div>
        </div>
      </section>
    <section className="about" aria-labelledby="about-heading">
        <div className="about-bg" aria-hidden="true"></div>
        <div className="container">
          <div className="about-inner">
            <div>
              <p className="section-label">Our Story</p>
              <h2 id="about-heading" className="section-title">From a Cruise Day Disaster to Brisbane's Trusted Parking Specialists</h2>
              <p>Last Christmas, what should have been the perfect cruise almost unravelled over one forgotten detail. Parking. After circling full car parks, dragging suitcases across gravel and paying peak rates for a less-than-ideal spot, we knew there had to be a better way.</p>
              <p>That experience created Sovereign Parking. We built the cruise terminal parking service we wished had existed. Secure, clean and just minutes from BICT. Today, with 500+ five-star Google Reviews behind us, we've expanded that same philosophy into airport parking, long-term parking and caravan storage, helping more Brisbane families travel and store with confidence.</p>
              <a href="/about" className="btn btn-pink btn-lg" style={{ marginTop: "8px" }}>Learn Our Story</a>
            </div>
            <div className="about-img">
              <img src="/images/094A3595.webp" alt="The Sovereign Parking team at Brisbane International Cruise Terminal" />
            </div>
          </div>
        </div>
      </section>
    <section className="before-book" id="before-book" aria-labelledby="before-book-heading">
        <div className="container">
          <div className="before-book-inner">
            <div>
              <p className="section-label">Important Information</p>
              <h2 id="before-book-heading" className="section-title">Before You Book</h2>
              <p className="section-desc" style={{ marginBottom: "32px" }}>A few things worth knowing about cruise day so your experience goes smoothly from the moment you arrive.</p>
    
              <div className="accordion" role="list">
                <div className="accordion-item" role="listitem">
                  <button className="accordion-btn" aria-expanded="true" aria-controls="acc-accessibility" id="acc-btn-1">
                    <span className="accordion-btn-text">Accessibility</span>
                    <svg className="accordion-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
                  </button>
                  <div className="accordion-body open" id="acc-accessibility" role="region" aria-labelledby="acc-btn-1">
                    Our car park does not currently accommodate guests with mobility limitations. If you are travelling with someone who needs assistance, we recommend dropping them off at the cruise terminal before parking with us.
                  </div>
                </div>
                <div className="accordion-item" role="listitem">
                  <button className="accordion-btn" aria-expanded="false" aria-controls="acc-dropoff" id="acc-btn-2">
                    <span className="accordion-btn-text">Passenger and Luggage Drop-Off</span>
                    <svg className="accordion-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
                  </button>
                  <div className="accordion-body" id="acc-dropoff" role="region" aria-labelledby="acc-btn-2">
                    For a smoother experience, we recommend that passengers and luggage be dropped off at the terminal first, where possible, before driving to our facility.
                  </div>
                </div>
                <div className="accordion-item" role="listitem">
                  <button className="accordion-btn" aria-expanded="false" aria-controls="acc-days" id="acc-btn-3">
                    <span className="accordion-btn-text">Parking Days and Availability</span>
                    <svg className="accordion-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
                  </button>
                  <div className="accordion-body" id="acc-days" role="region" aria-labelledby="acc-btn-3">
                    Cruise terminal parking operates between 6am and 2pm on scheduled cruise days. Airport parking, long-term parking and caravan storage are available on different terms. Check the relevant service page for details.
                  </div>
                </div>
                <div className="accordion-item" role="listitem">
                  <button className="accordion-btn" aria-expanded="false" aria-controls="acc-keys" id="acc-btn-4">
                    <span className="accordion-btn-text">Keys</span>
                    <svg className="accordion-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
                  </button>
                  <div className="accordion-body" id="acc-keys" role="region" aria-labelledby="acc-btn-4">
                    For insurance and liability purposes, our staff are required to park your vehicle on your behalf. We will collect your keys on arrival to ensure proper handling and security of your vehicle.
                  </div>
                </div>
                <div className="accordion-item" role="listitem">
                  <button className="accordion-btn" aria-expanded="false" aria-controls="acc-refund" id="acc-btn-5">
                    <span className="accordion-btn-text">Refund Policy</span>
                    <svg className="accordion-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
                  </button>
                  <div className="accordion-body" id="acc-refund" role="region" aria-labelledby="acc-btn-5">
                    We understand plans can change. Please double-check your booking details before confirming. Refunds are not available within 48 hours of your booking start time or for bookings made in error.
                  </div>
                </div>
              </div>
    
              <div style={{ marginTop: "28px" }}>
                <a href="/booking/cruise" className="btn btn-pink btn-lg">Check Availability and Book</a>
              </div>
            </div>
    
            <div>
              <div className="map-card">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3541.797432780211!2d153.1291865!3d-27.413248400000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b915f028b9b7773%3A0xd18683e5c17b5f4!2sSovereign%20Parking!5e0!3m2!1sen!2sau!4v1776037494248!5m2!1sen!2sau"
                  title="Sovereign Parking location map, 9 Harris Road, Pinkenba QLD"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
                <div className="map-info">
                  <div className="map-info-row">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                    <span><a href="https://maps.app.goo.gl/n4DkhwVm49GsWc4f8" target="_blank" rel="noopener">9 Harris Road, Pinkenba QLD 4008</a></span>
                  </div>
                  <div className="map-info-row">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.08 6.08l1.14-1.14a2 2 0 0 1 2.11-.45c.9.313 1.836.512 2.81.57a2 2 0 0 1 1.72 2.01z"/></svg>
                    <span><a href="tel:+61468472757">0468 472 757</a></span>
                  </div>
                  <div className="map-info-row">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Cruise days 6am – 2pm | Other services by appointment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    <section className="faq" id="faq" aria-labelledby="faq-heading">
        <div className="container">
          <div className="faq-header">
            <p className="section-label">FAQs</p>
            <h2 id="faq-heading" className="section-title">Frequently Asked Questions</h2>
            <p className="section-desc">Quick answers about cruise terminal parking, plus a few about our other services.</p>
          </div>
          <div className="faq-grid">
            <div className="faq-item">
              <h3>How do I get from Sovereign Parking to the cruise terminal?</h3>
              <p>We provide complimentary, convenient 2-way transfers directly between the Brisbane Cruise Terminal and our facility for you and your family at no extra charge.</p>
            </div>
            <div className="faq-item">
              <h3>Is my vehicle safe while I'm away on my cruise?</h3>
              <p>Absolutely. Our facility is protected by 24/7 monitored security, high-definition cameras, and secure perimeter fencing throughout your entire stay.</p>
            </div>
            <div className="faq-item">
              <h3>Do you offer airport parking too?</h3>
              <p>Yes. We're just 10 minutes from Brisbane Airport (BNE), making us a convenient off-airport option for longer trips. Airport parking is by phone enquiry. Call <a href="tel:+61468472757" style={{ color: "var(--blue)", textDecoration: "underline" }}>0468 472 757</a> or visit our <a href="/booking/airport" style={{ color: "var(--blue)", textDecoration: "underline" }}>long-term airport parking page</a>.</p>
            </div>
            <div className="faq-item">
              <h3>Can I store my caravan or boat with you?</h3>
              <p>Yes. We offer secure outdoor storage for caravans, boats, trailers and motorhomes at our Pinkenba facility. Storage availability is by phone enquiry. Call <a href="tel:+61468472757" style={{ color: "var(--blue)", textDecoration: "underline" }}>0468 472 757</a> or see our <a href="/booking/storage" style={{ color: "var(--blue)", textDecoration: "underline" }}>caravan storage page</a>.</p>
            </div>
            <div className="faq-item">
              <h3>Can I book online and pay on arrival?</h3>
              <p>Yes. You can pay online when booking, or pay on arrival at our facility. Your spot is confirmed either way once the booking is made.</p>
            </div>
            <div className="faq-item">
              <h3>Are you open every day?</h3>
              <p>Cruise terminal parking operates only on scheduled cruise days, between 6am and 2pm. Long-term parking and caravan storage operate on different schedules. Check the relevant service page or call us on 0468 472 757.</p>
            </div>
          </div>
        </div>
      </section>
    <section className="cta-banner" aria-labelledby="cta-heading">
        <div className="cta-banner-accent" aria-hidden="true"></div>
        <div className="container">
          <div className="cta-banner-inner">
            <h2 id="cta-heading">Your Next Cruise Deserves a <em>Stress-Free Start</em></h2>
            <p>Join 500+ Brisbane families who start their cruise the right way, with secure parking, a free shuttle, and complete peace of mind.</p>
            <div className="cta-group">
              <a href="/booking/cruise" className="btn btn-pink btn-xl">Book Your Cruise Parking</a>
              <a href="tel:+61468472757" className="btn btn-ghost btn-xl">Call 0468 472 757</a>
            </div>
          </div>
        </div>
      </section>
    </div>
      );
}
