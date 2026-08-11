import Link from "next/link";
import { AmbientDots } from "@/components/animations/AmbientDots";
import { Reveal } from "@/components/animations/Reveal";
import { ScrollProgress } from "@/components/animations/ScrollProgress";
import { StaggerGroup } from "@/components/animations/StaggerGroup";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <ScrollProgress />
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-dark-surface-2 via-dark-bg to-dark-bg" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl anim-glow-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl anim-float-slow" />
        <AmbientDots />

        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-28 lg:py-36">
          <div className="max-w-2xl space-y-6">
            <Reveal>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary leading-[1.1] font-display">
                The Complete Platform for{" "}
                <span className="text-primary">Bangladeshi Gamers</span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">
                Trade game items safely with escrow, compete in tournaments,
                build your reputation, and find the perfect squad — all in one
                place, built for the Bangladeshi gaming community.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/marketplace"
                className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-base"
              >
                Browse Marketplace
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/tournaments"
                className="btn-ghost inline-flex items-center justify-center gap-2 px-6 py-3 text-base"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Join a Tournament
              </Link>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== WHAT WE OFFER (4 FEATURES) ===== */}
      <section className="border-t border-dark-border bg-dark-surface">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary text-center mb-3 font-display">
              What We Offer
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-text-secondary text-center text-base mb-12 max-w-2xl mx-auto">
              Four powerful features that cover everything a Bangladeshi gamer
              needs — from safe trading to finding your next squad.
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <FeatureCard
              href="/marketplace"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Safe Marketplace"
              description="Buy and sell in-game accounts, skins, UC, and diamonds. Funds are held in escrow until both sides confirm — no more scams."
              cta="Browse Marketplace"
            />
            <FeatureCard
              href="/tournaments"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V4a2 2 0 10-2 2h2zm-4 5a4 4 0 118 0M5 19a2 2 0 100-4 2 2 0 000 4zm14 0a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              }
              title="Tournaments"
              description="Compete in organized tournaments with entry fees, prize pools, and automatic bracket generation. Climb the ranks and win real prizes."
              cta="View Tournaments"
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              title="Reputation Passport"
              description="Every player has a public passport with reputation score, badges, and game stats. Know exactly who you're trading or competing with."
              cta="Sign in to view your passport"
            />
            <FeatureCard
              href="/squads"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Squad Finder"
              description="Set your preferences and get matched with compatible, active players. No more solo queue — find your perfect squad in seconds."
              cta="Find a Squad"
            />
          </StaggerGroup>
        </div>
      </section>

      {/* ===== TRUST SIGNALS ===== */}
      <section className="border-t border-dark-border bg-dark-bg">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <StaggerGroup gap={80} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <TrustCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Funds Held in Escrow"
              description="Your money is only released when you confirm delivery. No risk of losing your payment."
            />
            <TrustCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="bKash & Nagad Supported"
              description="Pay and get paid using the mobile financial services you already use every day."
            />
            <TrustCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
              title="Verified Reputation"
              description="Every player has a public reputation score and history so you know who you're dealing with."
            />
            <TrustCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              }
              title="Dispute Protection"
              description="If something goes wrong, open a dispute and an admin mediator will help resolve the issue fairly."
            />
          </StaggerGroup>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="border-t border-dark-border bg-dark-surface">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary text-center mb-12 font-display">
              How It Works
            </h2>
          </Reveal>

          <StaggerGroup gap={80} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <StepCard
              stepNumber={1}
              title="List Your Item"
              description="Create a listing with screenshots, description, and your price. Set it live in seconds."
            />
            <StepCard
              stepNumber={2}
              title="Buyer Pays Into Escrow"
              description="The buyer sends payment via bKash or Nagad. Funds are held securely — the seller never touches them yet."
            />
            <StepCard
              stepNumber={3}
              title="Deliver the Item"
              description="The seller delivers the account, skin, or UC. Upload a proof screenshot as confirmation."
            />
            <StepCard
              stepNumber={4}
              title="Funds Released"
              description="The buyer confirms receipt. Funds are released to the seller. Done — safe and fair for both sides."
            />
          </StaggerGroup>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="border-t border-dark-border bg-dark-bg">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20 text-center space-y-4">
          <Reveal variant="fade">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary font-display">
              Ready to level up your gaming?
            </h2>
          </Reveal>
          <Reveal variant="fade" delay={120}>
            <p className="text-text-secondary text-base sm:text-lg">
              Join the Bangladeshi gaming community already using GOB to trade,
              compete, and squad up — all in one trusted platform.
            </p>
          </Reveal>
          <Reveal variant="fade" delay={240}>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/marketplace"
              className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-base"
            >
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/squads"
              className="btn-ghost inline-flex items-center justify-center gap-2 px-6 py-3 text-base"
            >
              Find a Squad
            </Link>
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-dark-border bg-dark-surface">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className="text-lg">🎮</span>
            <span className="font-semibold text-text-primary">GOB</span>
            <span className="text-text-muted">·</span>
            <span>Gamers of Bangladesh</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-text-muted">
            <Link href="/marketplace" className="hover:text-text-primary transition-colors">
              Marketplace
            </Link>
            <Link href="/tournaments" className="hover:text-text-primary transition-colors">
              Tournaments
            </Link>
            <Link href="/squads" className="hover:text-text-primary transition-colors">
              Squads
            </Link>
            <Link href="/trades" className="hover:text-text-primary transition-colors">
              Trades
            </Link>
            <span className="text-text-muted">·</span>
            <span>Built for the Bangladeshi gaming community 🇧🇩</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
  cta,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  const inner = (
    <>
      <div className="w-12 h-12 rounded-xl bg-primary-subtle text-primary-light flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-text-primary text-lg">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed mt-2">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-light group-hover:text-primary transition-colors">
        {cta}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </span>
    </>
  );

  const className =
    "group bg-dark-surface-2 border border-dark-border rounded-xl p-6 space-y-4 hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300";

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function TrustCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-dark-surface-2 border border-dark-border rounded-xl p-5 space-y-3 transition-colors hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="w-10 h-10 rounded-lg bg-primary-subtle text-primary-light flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary text-sm">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  stepNumber,
  title,
  description,
}: {
  stepNumber: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold shrink-0">
        {stepNumber}
      </div>
      <h3 className="font-semibold text-text-primary text-base">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed max-w-xs">{description}</p>
    </div>
  );
}