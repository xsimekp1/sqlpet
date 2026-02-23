import { MarketingNav } from '@/app/components/landing/MarketingNav';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { WhySection } from '@/app/components/landing/WhySection';
import { PricingSection } from '@/app/components/landing/PricingSection';
import { AboutSection } from '@/app/components/landing/AboutSection';
import { SocialProofSection } from '@/app/components/landing/SocialProofSection';
import { FaqSection } from '@/app/components/landing/FaqSection';
import { FooterSection } from '@/app/components/landing/FooterSection';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <MarketingNav locale={locale} />
      <main>
        <HeroSection />
        <WhySection />
        <PricingSection />
        <AboutSection />
        <SocialProofSection />
        <FaqSection />
        <FooterSection locale={locale} />
      </main>
    </>
  );
}
