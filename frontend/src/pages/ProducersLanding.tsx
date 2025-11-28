import { LandingCategories } from '@/components/landing/LandingCategories'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks'
import { LandingStories } from '@/components/landing/LandingStories'

export const ProducersLandingPage = () => (
  <>
    <LandingHero />
    <LandingCategories />
    <LandingStories />
    <LandingHowItWorks />
  </>
)

