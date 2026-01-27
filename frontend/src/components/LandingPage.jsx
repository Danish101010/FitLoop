import { Link } from 'react-router-dom'
import { Camera, Target, Sparkles, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">FitLoop</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/auth" className="nav-link hidden sm:block">
                Sign In
              </Link>
              <Link to="/auth?signup=true" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white border-b border-gray-100">
        <div className="page-container section">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-1 text-balance">
              Track Your Nutrition with
              <span className="text-brand-600"> AI Precision</span>
            </h1>
            <p className="text-body text-lg mt-6 max-w-2xl mx-auto text-balance">
              Simply take a photo of your meal and get instant, accurate nutrition data. 
              FitLoop uses advanced AI to identify foods and calculate macros automatically.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link to="/auth?signup=true" className="btn-primary btn-lg w-full sm:w-auto">
                Start Free Today
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/auth" className="btn-secondary btn-lg w-full sm:w-auto">
                Sign In
              </Link>
            </div>
            <p className="text-muted mt-4">No credit card required • Free to use</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="page-container">
          <div className="text-center mb-12">
            <h2 className="heading-2">How FitLoop Works</h2>
            <p className="text-body mt-3">Three simple steps to accurate nutrition tracking</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              icon={Camera}
              title="Snap a Photo"
              description="Take a picture of your meal. Our AI works with any food, from home cooking to restaurant dishes."
            />
            <StepCard
              step="2"
              icon={Sparkles}
              title="AI Analysis"
              description="Our advanced AI instantly identifies each food item and calculates accurate nutrition information."
            />
            <StepCard
              step="3"
              icon={Target}
              title="Track & Improve"
              description="Review your daily intake, get personalized recommendations, and reach your nutrition goals."
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white border-y border-gray-100 section">
        <div className="page-container">
          <div className="text-center mb-12">
            <h2 className="heading-2">Why Choose FitLoop</h2>
            <p className="text-body mt-3">Built for accuracy, designed for simplicity</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Recognition"
              description="Advanced computer vision identifies foods with high accuracy, even complex dishes with multiple ingredients."
            />
            <FeatureCard
              icon={Target}
              title="Precise Macro Tracking"
              description="Get detailed breakdowns of calories, protein, carbs, and fat for every meal you log."
            />
            <FeatureCard
              icon={TrendingUp}
              title="Progress Insights"
              description="Visual dashboards show your nutrition trends over time, helping you stay on track."
            />
            <FeatureCard
              icon={CheckCircle}
              title="Personalized Goals"
              description="Set custom calorie and macro targets based on your fitness objectives."
            />
            <FeatureCard
              icon={Camera}
              title="Quick Logging"
              description="Log meals in seconds. No manual entry or food database searching required."
            />
            <FeatureCard
              icon={Sparkles}
              title="Smart Recommendations"
              description="Receive personalized suggestions to help balance your daily nutrition."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section">
        <div className="page-container">
          <div className="card card-body text-center py-12 sm:py-16">
            <h2 className="heading-2">Ready to Transform Your Nutrition?</h2>
            <p className="text-body mt-3 max-w-xl mx-auto">
              Join thousands of users who are achieving their health goals with AI-powered nutrition tracking.
            </p>
            <div className="mt-8">
              <Link to="/auth?signup=true" className="btn-primary btn-lg">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="page-container py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">F</span>
              </div>
              <span className="font-semibold text-gray-900">FitLoop</span>
            </div>
            <p className="text-muted">
              © {new Date().getFullYear()} FitLoop. AI-powered nutrition tracking.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StepCard({ step, icon: Icon, title, description }) {
  return (
    <div className="text-center">
      <div className="relative inline-flex">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center">
          <Icon className="w-8 h-8 text-brand-600" />
        </div>
        <span className="absolute -top-2 -right-2 w-7 h-7 bg-brand-600 text-white text-sm font-semibold rounded-full flex items-center justify-center">
          {step}
        </span>
      </div>
      <h3 className="heading-4 mt-5">{title}</h3>
      <p className="text-body-sm mt-2">{description}</p>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="card card-body">
      <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-600" />
      </div>
      <h3 className="heading-4 mt-4">{title}</h3>
      <p className="text-body-sm mt-2">{description}</p>
    </div>
  )
}
