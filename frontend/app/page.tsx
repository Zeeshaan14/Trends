import { HeroSection } from "@/components/hero-section"
import { TrendingJerseys } from "@/components/trending-jerseys"
import { WhyChooseUs } from "@/components/why-choose-us"
import { Newsletter } from "@/components/newsletter"

export default function Home() {
  return (
    <>
      <HeroSection />
      <TrendingJerseys />
      <WhyChooseUs />
      
      {/* Payment Note Section */}
      <section className="py-12 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-6 py-5 rounded-xl text-center shadow-sm">
            <p className="text-base sm:text-lg">
              <strong>Note:</strong> After payment, if the design is not installed, please contact us at{" "}
              <a href="tel:8550002364" className="font-bold hover:underline">8550002364</a> or mail{" "}
              <a href="mailto:nu3jersey@gmail.com" className="font-bold hover:underline">nu3jersey@gmail.com</a>.
            </p>
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  )
}
