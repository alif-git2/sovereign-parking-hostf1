"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const BLOCKED_EXACT_PATHS = new Set([
  "/login",
  "/forget-password",
  "/reset-password",
  "/set-password",
  "/verify-otp",
  "/booking/success",
]);

const BLOCKED_PATH_PREFIXES = [
  "/admin",
  "/customer",
  "/backend",
  "/booking/payment",
  "/booking/paypal",
  "/wallet",
];

function isTrackingAllowed(pathname = "/") {
  if (BLOCKED_EXACT_PATHS.has(pathname)) {
    return false;
  }

  return !BLOCKED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function normalizeGoogleTrackingId(value) {
  const id = String(value || "").trim().toUpperCase();

  if (/^G-[A-Z0-9]+$/.test(id) || /^GTM-[A-Z0-9]+$/.test(id)) {
    return id;
  }

  return "";
}

function normalizeMetaPixelId(value) {
  const id = String(value || "").trim();
  return /^\d{5,25}$/.test(id) ? id : "";
}

export default function TrackingScripts({
  googleAnalyticsId = "",
  facebookPixelId = "",
}) {
  const pathname = usePathname() || "/";
  const trackingAllowed = isTrackingAllowed(pathname);
  const googleId = useMemo(
    () => normalizeGoogleTrackingId(googleAnalyticsId),
    [googleAnalyticsId]
  );
  const metaPixelId = useMemo(
    () => normalizeMetaPixelId(facebookPixelId),
    [facebookPixelId]
  );

  const isGa4 = googleId.startsWith("G-");
  const isGtm = googleId.startsWith("GTM-");

  const [gaReady, setGaReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const lastGaPath = useRef("");
  const lastMetaPath = useRef("");
  const initialGtmPath = useRef(pathname);

  useEffect(() => {
    if (!trackingAllowed || !isGa4 || !gaReady || !window.gtag) {
      return;
    }

    if (lastGaPath.current === pathname) {
      return;
    }

    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });

    lastGaPath.current = pathname;
  }, [gaReady, isGa4, pathname, trackingAllowed]);

  useEffect(() => {
    if (!trackingAllowed || !metaPixelId || !metaReady || !window.fbq) {
      return;
    }

    if (lastMetaPath.current === pathname) {
      return;
    }

    window.fbq("track", "PageView");
    lastMetaPath.current = pathname;
  }, [metaPixelId, metaReady, pathname, trackingAllowed]);

  useEffect(() => {
    if (!trackingAllowed || !isGtm || pathname === initialGtmPath.current) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "virtual_page_view",
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [isGtm, pathname, trackingAllowed]);

  if (!trackingAllowed) {
    return null;
  }

  return (
    <>
      {isGa4 && (
        <Script
          id="google-analytics-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
            googleId
          )}`}
          strategy="afterInteractive"
          onReady={() => {
            window.dataLayer = window.dataLayer || [];
            window.gtag =
              window.gtag ||
              function gtag() {
                window.dataLayer.push(arguments);
              };

            window.gtag("js", new Date());
            window.gtag("config", googleId, { send_page_view: false });
            setGaReady(true);
          }}
        />
      )}

      {isGtm && (
        <>
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${googleId}');`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(
                googleId
              )}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      )}

      {metaPixelId && (
        <>
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            onReady={() => setMetaReady(true)}
          >
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaPixelId}');`}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(
                metaPixelId
              )}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  );
}
