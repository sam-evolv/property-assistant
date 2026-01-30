'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  BarChart3,
  ChefHat,
  ClipboardCheck,
  Mail,
  FileText,
  Bot,
  Shield,
  Smartphone,
  Clock,
  ShieldCheck,
  PhoneOff,
  Palette,
  TrendingUp,
  Rocket,
  ArrowRight,
} from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Slide {
  id: string;
  title: string;
  heading: string;
  subtitle: string;
  icon: React.ReactNode;
  features?: Feature[];
  content?: React.ReactNode;
}

const slides: Slide[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    heading: 'Welcome to OpenHouse Ai',
    subtitle: 'The smarter way to manage homebuyers and handovers',
    icon: <Building2 className="w-12 h-12" strokeWidth={1.5} />,
    content: (
      <div className="bg-gradient-to-br from-black to-grey-900 rounded-2xl p-8 border border-gold-500/20">
        <p className="text-lg text-grey-300 leading-relaxed text-center">
          From first sale to final handover — and beyond. One platform to manage your buyers, 
          track progress, and give homeowners a premium digital experience.
        </p>
      </div>
    ),
  },
  {
    id: 'pre-handover',
    title: 'Pre-Handover Portal',
    heading: 'Track Every Sale, Every Buyer',
    subtitle: 'Your pre-handover command centre',
    icon: <BarChart3 className="w-12 h-12" strokeWidth={1.5} />,
    features: [
      {
        icon: <BarChart3 className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Sales Pipeline',
        description: 'Track every unit from reserved to sold to handed over',
      },
      {
        icon: <ChefHat className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Kitchen Selections',
        description: 'Buyers choose upgrades, you see selections instantly',
      },
      {
        icon: <ClipboardCheck className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Compliance Tracking',
        description: 'Chase documents, track acknowledgments, stay audit-ready',
      },
      {
        icon: <Mail className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Buyer Communications',
        description: 'Message buyers directly, all in one place',
      },
    ],
  },
  {
    id: 'homeowner-portal',
    title: 'Homeowner Portal',
    heading: 'A Premium Experience for Homeowners',
    subtitle: 'Happy homeowners, fewer phone calls',
    icon: <Smartphone className="w-12 h-12" strokeWidth={1.5} />,
    features: [
      {
        icon: <FileText className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Digital Document Pack',
        description: 'Warranties, manuals, certs — searchable, always available',
      },
      {
        icon: <Bot className="w-6 h-6" strokeWidth={1.5} />,
        title: '24/7 Ai Assistant',
        description: 'Answers questions instantly using your documents',
      },
      {
        icon: <Shield className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Legal Protection',
        description: 'Timestamped acknowledgments prove what was delivered and when',
      },
      {
        icon: <Smartphone className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Works Everywhere',
        description: 'Mobile, tablet, desktop — no app download needed',
      },
    ],
  },
  {
    id: 'benefits',
    title: 'Benefits for You',
    heading: 'Why Developers Choose OpenHouse Ai',
    subtitle: 'Save time. Reduce risk. Look professional.',
    icon: <TrendingUp className="w-12 h-12" strokeWidth={1.5} />,
    features: [
      {
        icon: <Clock className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Cut admin time by 80%',
        description: 'No more printing, posting, or chasing paper',
      },
      {
        icon: <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Legal protection built-in',
        description: 'Timestamped proof of every document delivered',
      },
      {
        icon: <PhoneOff className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Fewer support calls',
        description: 'Ai handles the "where\'s my boiler manual?" questions',
      },
      {
        icon: <Palette className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Premium brand experience',
        description: 'White-labelled portal with your logo and colours',
      },
      {
        icon: <TrendingUp className="w-6 h-6" strokeWidth={1.5} />,
        title: 'Real-time insights',
        description: 'See engagement, track handovers, spot issues early',
      },
    ],
  },
  {
    id: 'get-started',
    title: 'Get Started',
    heading: "Let's Set Up Your First Development",
    subtitle: 'Takes about 2 minutes',
    icon: <Rocket className="w-12 h-12" strokeWidth={1.5} />,
    content: (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-gold-50 to-gold-100/50 rounded-2xl p-8 border border-gold-200">
          <p className="text-lg text-grey-700 leading-relaxed text-center">
            Tell us about your development and we'll be in touch within 48 hours to get you live.
          </p>
        </div>
      </div>
    ),
  },
];

export default function DeveloperOnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < slides.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push('/onboarding/create-development');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/create-development');
  };

  const slide = slides[currentStep];
  const progress = ((currentStep + 1) / slides.length) * 100;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-3xl border border-grey-200 shadow-xl p-6 sm:p-10 lg:p-12">
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-grey-500">
                Step {currentStep + 1} of {slides.length}
              </span>
              <span className="text-sm font-medium text-gold-600">
                {slide.title}
              </span>
            </div>
            <div className="h-1.5 bg-grey-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gold-400 to-gold-500 rounded-2xl text-white mb-6 shadow-lg">
              {slide.icon}
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-black mb-3 tracking-tight">
              {slide.heading}
            </h1>
            <p className="text-lg text-grey-600 max-w-xl mx-auto">
              {slide.subtitle}
            </p>
          </div>

          {slide.content && (
            <div className="mb-10">
              {slide.content}
            </div>
          )}

          {slide.features && (
            <div className={`grid gap-4 mb-10 ${
              slide.features.length === 5 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1 sm:grid-cols-2'
            }`}>
              {slide.features.map((feature, index) => (
                <div 
                  key={feature.title}
                  className={`group bg-grey-50 hover:bg-white rounded-xl p-5 transition-all duration-300 border border-grey-100 hover:border-gold-200 hover:shadow-lg ${
                    slide.features?.length === 5 && index === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-11 h-11 bg-white group-hover:bg-gold-50 rounded-xl flex items-center justify-center text-gold-600 transition-colors duration-300 shadow-sm">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-black mb-1 text-sm">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-grey-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-grey-100">
            <button
              onClick={handleSkip}
              className="px-6 py-3 text-sm font-medium text-grey-500 hover:text-grey-700 transition-colors duration-200"
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
            >
              {currentStep === slides.length - 1 ? 'Create Development' : 'Continue'}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-gold-500'
                    : index < currentStep
                    ? 'w-2 bg-gold-300'
                    : 'w-2 bg-grey-200 hover:bg-grey-300'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-grey-500">
            Questions? Email us at{' '}
            <a 
              href="mailto:sam@openhouseai.ie" 
              className="text-gold-600 hover:text-gold-700 font-medium transition-colors"
            >
              sam@openhouseai.ie
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
