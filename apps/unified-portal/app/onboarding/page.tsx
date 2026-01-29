'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to OpenHouse AI',
    subtitle: 'Premium property management made simple',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: 'features',
    title: 'Enterprise-Grade Tools',
    subtitle: 'Everything you need to manage properties at scale',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'ready',
    title: 'Ready to Launch',
    subtitle: "Let's create your first development",
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

const features = [
  {
    title: 'Multi-Tenant Architecture',
    description: 'Manage multiple developments with isolated data and custom branding',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    title: 'AI-Powered Chat',
    description: 'RAG-based assistant trained on your property documents and manuals',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: 'White-Label Theming',
    description: 'Customise colours, logos, and branding for each development',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    title: 'QR Code Onboarding',
    description: 'Homeowners scan QR codes at their property for instant access',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
];

export default function DeveloperOnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push('/onboarding/create-development');
    }
  };

  const handleSkip = () => {
    router.push('/developer');
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-grey-50/50 to-gold-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-premium border border-grey-200 shadow-premium-lg p-8 sm:p-12 motion-safe:animate-scale-in">
          <div className="mb-8">
            <div className="h-2 bg-grey-100 rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all duration-premium ease-premium"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="text-center mb-8 motion-safe:animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-black rounded-premium text-gold-500 mb-6 border-2 border-gold-500">
              {step.icon}
            </div>
            <h1 className="text-display text-black mb-3">{step.title}</h1>
            <p className="text-body-lg text-grey-600">{step.subtitle}</p>
          </div>

          {currentStep === 0 && (
            <div className="space-y-4 mb-8 motion-safe:animate-slide-up">
              <div className="bg-gradient-to-br from-black to-grey-900 rounded-premium p-6 border-2 border-gold-500/20">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-gold-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-heading-md text-gold-100 mb-2">Production-Grade Platform</h3>
                    <p className="text-body text-gold-200/80">
                      Built for scale with multi-tenant architecture, RAG AI, comprehensive RBAC, 
                      and enterprise security. Support 10,000+ developments out of the box.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {features.map((feature, index) => (
                <div 
                  key={feature.title}
                  className="bg-grey-50 rounded-premium p-5 hover-lift border border-grey-200 motion-safe:animate-slide-up"
                  style={{animationDelay: `${index * 75}ms`}}
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 bg-gold-50 rounded-premium flex items-center justify-center text-gold-600">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-body-lg font-semibold text-black mb-1">{feature.title}</h3>
                      <p className="text-body-sm text-grey-600">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 mb-8 motion-safe:animate-slide-up">
              <div className="bg-gradient-to-br from-gold-500 to-gold-600 rounded-premium p-6 text-black">
                <h3 className="text-heading-md mb-3">Quick Start Checklist</h3>
                <div className="space-y-3">
                  {[
                    'Create your first development',
                    'Upload property documents and manuals',
                    'Add homeowners and assign units',
                    'Customise your tenant portal theme',
                    'Share QR codes with new homeowners'
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 text-body-sm">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-grey-50 rounded-premium p-4 border-l-4 border-gold-500">
                <p className="text-body-sm text-grey-700">
                  <strong className="text-black">Pro tip:</strong> Start small with one development, 
                  then scale up as you get comfortable with the platform.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleSkip}
              className="px-6 py-3 text-body font-medium text-grey-600 hover:text-black transition-colors duration-premium"
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-gradient-to-br from-gold-500 to-gold-600 text-black rounded-premium font-semibold hover:shadow-gold-glow transition-all duration-premium hover-lift"
            >
              {currentStep === steps.length - 1 ? 'Create Development' : 'Continue'}
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-premium ${
                  index === currentStep
                    ? 'w-8 bg-gold-500'
                    : 'w-2 bg-grey-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-body-sm text-grey-500 mb-2">
            Need help getting started?
          </p>
          <a href="mailto:support@openhouse.ai" className="text-body-sm text-gold-600 hover:text-gold-700 font-medium">
            Contact our support team
          </a>
        </div>
      </div>
    </div>
  );
}
