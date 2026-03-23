import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-shimofuri">
      <div className="text-center space-y-6">
        <h1 className="font-heading text-6xl font-light tracking-wide text-sumi">
          WAGYU SAMURAI
        </h1>
        <div className="w-24 h-px bg-charcoal-red mx-auto" />
        <p className="font-body text-lg text-sumi-light tracking-widest uppercase">
          Premium Wagyu Management Platform
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <span className="inline-block w-3 h-3 rounded-full bg-sumi" />
          <span className="inline-block w-3 h-3 rounded-full bg-charcoal-red" />
          <span className="inline-block w-3 h-3 rounded-full bg-gold" />
          <span className="inline-block w-3 h-3 rounded-full bg-shimofuri border border-sumi/20" />
          <span className="inline-block w-3 h-3 rounded-full bg-sumi-light" />
        </div>
        <p className="text-sm text-sumi/50 mt-4">Color palette preview</p>
        <nav className="mt-12 flex flex-wrap gap-3 justify-center">
          {[
            { href: "/upload", label: "Upload" },
            { href: "/review", label: "Review & Publish" },
            { href: "/bookings", label: "Booking Manager" },
            { href: "/stores", label: "Store Database" },
            { href: "/analytics", label: "Analytics" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-5 py-2.5 border border-sumi/20 text-sumi text-sm tracking-wide hover:bg-sumi hover:text-shimofuri transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
