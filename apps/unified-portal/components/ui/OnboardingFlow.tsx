'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  image?: string;
}

interface OnboardingFlowProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  showProgress?: boolean;
  allowSkip?: boolean;
  storageKey?: string; // LocalStorage key to persist completion
}

export function OnboardingFlow({
  steps,
  onComplete,
  onSkip,
  showProgress = true,
  allowSkip = true,
  storageKey,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Check if already completed
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const completed = localStorage.getItem(storageKey);
      if (completed === 'true') {
        setIsVisible(false);
      }
    }
  }, [storageKey]);

  // Find and highlight target element
  useEffect(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const element = document.querySelector(step.target!);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    };

    findTarget();
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget);

    return () => {
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget);
    };
  }, [step?.target]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible || typeof window === 'undefined') return null;

  // Calculate tooltip position relative to target
  const getTooltipStyles = () => {
    if (!targetRect) {
      // Center in viewport if no target
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const position = step.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          bottom: `${window.innerHeight - targetRect.top + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          right: `${window.innerWidth - targetRect.left + padding}px`,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + padding}px`,
          transform: 'translateY(-50%)',
        };
    }
  };

  const content = (
    <>
      {/* Backdrop with spotlight */}
      <div
        className="fixed inset-0 z-40"
        onClick={allowSkip ? handleSkip : undefined}
      >
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 8}
                  y={targetRect.top - 8}
                  width={targetRect.width + 16}
                  height={targetRect.height + 16}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-50 w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        style={getTooltipStyles()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-gold-50 to-amber-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gold-100">
              <Sparkles className="w-4 h-4 text-gold-600" />
            </div>
            <span className="text-xs font-semibold text-gold-700 uppercase tracking-wide">
              Getting Started
            </span>
          </div>
          {allowSkip && (
            <button
              onClick={handleSkip}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {step.image && (
            <div className="mb-4 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-32 object-cover"
              />
            </div>
          )}

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {step.description}
          </p>

          {step.action && (
            <div className="mt-4">
              {step.action.href ? (
                <a
                  href={step.action.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:text-gold-700"
                >
                  {step.action.label}
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <button
                  onClick={step.action.onClick}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:text-gold-700"
                >
                  {step.action.label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          {/* Progress */}
          {showProgress && (
            <div className="flex items-center gap-1.5">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    index === currentStep
                      ? 'w-6 bg-gold-500'
                      : index < currentStep
                      ? 'bg-gold-300'
                      : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition-colors"
            >
              {isLastStep ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

// Hook to manage onboarding state
export function useOnboarding(storageKey: string) {
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem(storageKey);
      setHasCompleted(completed === 'true');
    }
  }, [storageKey]);

  const reset = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
      setHasCompleted(false);
    }
  };

  return { hasCompleted, reset };
}

export default OnboardingFlow;
