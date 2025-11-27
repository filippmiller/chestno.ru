import { LandingCategories } from '@/components/landing/LandingCategories'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks'
import { LandingStories } from '@/components/landing/LandingStories'

export const ProducersLandingPage = () => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <LandingHeader />
    <main className="flex-1">
      <LandingHero />
      <LandingCategories />
      <LandingStories />
      <LandingHowItWorks />
    </main>
    <LandingFooter />
  </div>
)

