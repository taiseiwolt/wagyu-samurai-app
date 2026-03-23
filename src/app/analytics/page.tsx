import Link from "next/link";

export default function AnalyticsPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="font-heading text-4xl font-light text-sumi">ANALYTICS</h1>
        <div className="w-16 h-px bg-charcoal-red mx-auto" />
        <p className="text-sumi-light text-sm">Coming soon</p>
        <Link href="/" className="inline-block mt-6 text-sm text-gold hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
