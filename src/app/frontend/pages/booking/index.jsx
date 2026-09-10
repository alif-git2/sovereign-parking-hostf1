import Link from "next/link";
import { Ship, Anchor, Plane, ArrowRight } from "lucide-react";
import Navbar from "../../component/global/NavBar";
import Footer from "../../component/global/Footer";

const bookingTypes = [
  {
    title: "Cruise Parking",
    description:
      "Stress-free parking for your next sea adventure. Shuttle included.",
    href: "/booking/cruise",
    icon: Ship,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
  {
    title: "Storage Booking",
    description: "Store your boat, caravan, or motorhome.",
    href: "/booking/storage",
    icon: Anchor,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    title: "Airport Parking",
    description:
      "Quick parking and fast shuttles to all major airport terminals.",
    href: "/booking/airport",
    icon: Plane,
    iconBg: "bg-amber-50",
    iconColor: "text-orange-500",
  },
];

export default function BookingHomePage() {
  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-white px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-slate-950">
            Choose Your Booking Service
          </h1>

          <p className="mt-2 text-slate-500">
            Select a tailored solution for your specific travel needs.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {bookingTypes.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-[260px] flex-col rounded-[32px] border border-slate-100 bg-slate-50/70 p-8 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg"
                >
                  {/* Icon */}
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-2xl ${item.iconBg}`}
                  >
                    <Icon
                      size={32}
                      strokeWidth={2.7}
                      className={item.iconColor}
                    />
                  </div>

                  {/* Content */}
                  <div className="mt-8">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                      {item.title}
                    </h2>

                    <p className="mt-5 text-base font-medium leading-7 text-slate-500">
                      {item.description}
                    </p>
                  </div>

                  {/* Button */}
                  <div className="mt-auto pt-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#1c6de0] px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-md transition-all duration-300 hover:bg-[#155fc7]">
                      Start Booking
                      <ArrowRight
                        size={18}
                        strokeWidth={2.4}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}