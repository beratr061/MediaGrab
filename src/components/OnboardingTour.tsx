import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, Download, Settings, ListOrdered, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "mediagrab-onboarding-completed";

interface TourStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: ReactNode;
  target?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    titleKey: "onboarding.welcome.title",
    descriptionKey: "onboarding.welcome.description",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
  },
  {
    id: "url",
    titleKey: "onboarding.url.title",
    descriptionKey: "onboarding.url.description",
    icon: <Download className="h-8 w-8 text-primary" />,
    target: "#url-input",
  },
  {
    id: "queue",
    titleKey: "onboarding.queue.title",
    descriptionKey: "onboarding.queue.description",
    icon: <ListOrdered className="h-8 w-8 text-primary" />,
  },
  {
    id: "history",
    titleKey: "onboarding.history.title",
    descriptionKey: "onboarding.history.description",
    icon: <History className="h-8 w-8 text-primary" />,
  },
  {
    id: "settings",
    titleKey: "onboarding.settings.title",
    descriptionKey: "onboarding.settings.description",
    icon: <Settings className="h-8 w-8 text-primary" />,
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Delay showing the tour to let the app load
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
    onComplete?.();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const step = TOUR_STEPS[currentStep];
  
  if (!step) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/60 backdrop-blur-sm"
            onClick={handleSkip}
          />

          {/* Tour Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-201 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={t("buttons.close")}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Content */}
            <div className="text-center">
              {/* Icon */}
              <motion.div
                key={step.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
              >
                {step.icon}
              </motion.div>

              {/* Title */}
              <motion.h2
                key={`title-${step.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                id="onboarding-title"
                className="text-xl font-semibold text-foreground"
              >
                {t(step.titleKey)}
              </motion.h2>

              {/* Description */}
              <motion.p
                key={`desc-${step.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-2 text-muted-foreground"
              >
                {t(step.descriptionKey)}
              </motion.p>

              {/* Progress dots */}
              <div className="mt-6 flex justify-center gap-2">
                {TOUR_STEPS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      "h-2 w-2 rounded-full transition-all",
                      index === currentStep
                        ? "w-6 bg-primary"
                        : "bg-muted hover:bg-muted-foreground/50"
                    )}
                    aria-label={`Step ${index + 1}`}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("onboarding.prev")}
                </Button>

                <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                  {t("onboarding.skip")}
                </Button>

                <Button onClick={handleNext} className="gap-1">
                  {currentStep === TOUR_STEPS.length - 1 ? t("onboarding.finish") : t("onboarding.next")}
                  {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}
