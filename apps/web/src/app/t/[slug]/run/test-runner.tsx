"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { LocalizedQuestion } from "@/lib/content/types";
import {
  completeAttempt,
  emitAttemptEntryPageView,
  startAttempt
} from "@/lib/product/client";
import {
  RESUME_STATE_VERSION,
  clearResumeState,
  loadResumeState,
  saveResumeState,
  type ResumeState
} from "@/lib/product/resume_state";
import { cn } from "@/lib/ui/cn";

const FLOW_CARD_CLASS_NAME =
  "border-border/70 bg-card/95 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.55)]";

const ERROR_BANNER_CLASS_NAME =
  "w-full rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive";

type RunnerTest = {
  testId: string;
  slug: string;
  title: string;
  intro: string;
  questions: LocalizedQuestion[];
};

type AttemptState = {
  sessionId: string;
  attemptToken: string;
};

type RunnerProps = {
  test: RunnerTest;
};

type FlowFrameProps = {
  children: ReactNode;
  className?: string;
};

function FlowFrame({ children, className }: FlowFrameProps) {
  return (
    <section className={cn("mx-auto w-full max-w-[72rem] px-4 sm:px-6", className)}>
      <div className="studio-shell">
        <div className="studio-stack">{children}</div>
      </div>
    </section>
  );
}

export default function TestRunnerClient({ test }: RunnerProps) {
  const router = useRouter();
  const questionHeadingId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [resumeState, setResumeState] = useState<ResumeState | null>(null);
  const [isResumeLoaded, setIsResumeLoaded] = useState(false);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQuestions = test.questions.length;
  const currentQuestion = totalQuestions > 0 ? test.questions[currentIndex] : null;
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : null;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const canProceed = Boolean(selectedOption);
  const progressValue =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  useEffect(() => {
    setResumeState(loadResumeState(test.testId, test.slug));
    setIsResumeLoaded(true);
  }, [test.slug, test.testId]);

  useEffect(() => {
    if (!attempt) {
      return;
    }

    saveResumeState({
      version: RESUME_STATE_VERSION,
      test_id: test.testId,
      slug: test.slug,
      session_id: attempt.sessionId,
      attempt_token: attempt.attemptToken,
      current_index: currentIndex,
      answers,
      updated_at_utc: new Date().toISOString()
    });
  }, [answers, attempt, currentIndex, test.slug, test.testId]);

  useEffect(() => {
    if (!attempt || !currentQuestion) {
      return;
    }

    const selectedIndex = currentQuestion.options.findIndex((option) => {
      return option.id === selectedOption;
    });
    setFocusedOptionIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [attempt, currentIndex, currentQuestion, selectedOption]);

  const moveFocusedOption = (direction: -1 | 1): void => {
    if (!currentQuestion || currentQuestion.options.length === 0) {
      return;
    }

    setFocusedOptionIndex((previousIndex) => {
      const optionCount = currentQuestion.options.length;
      const safeIndex =
        previousIndex >= 0 && previousIndex < optionCount ? previousIndex : 0;
      const nextIndex = (safeIndex + direction + optionCount) % optionCount;

      requestAnimationFrame(() => {
        optionRefs.current[nextIndex]?.focus();
      });

      return nextIndex;
    });
  };

  const startNewAttempt = async (): Promise<void> => {
    if (isStarting) {
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      const response = await startAttempt(test.testId);
      setAttempt({
        sessionId: response.session_id,
        attemptToken: response.attempt_token
      });
      setCurrentIndex(0);
      setFocusedOptionIndex(0);
      setAnswers({});
      setResumeState(null);

      void emitAttemptEntryPageView({
        test_id: test.testId,
        session_id: response.session_id,
        attempt_token: response.attempt_token,
        page_type: "attempt_entry",
        page_url: window.location.pathname
      }).catch(() => null);
    } catch (error) {
      logger.warn({ error }, "app/t/[slug]/run/test-runner.tsx fallback handling failed");
      setError("Unable to start the test. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStart = () => {
    void startNewAttempt();
  };

  const handleContinue = () => {
    if (!resumeState) {
      return;
    }

    const maxIndex = Math.max(totalQuestions - 1, 0);
    const clampedIndex = Math.min(Math.max(resumeState.current_index, 0), maxIndex);

    setError(null);
    setAttempt({
      sessionId: resumeState.session_id,
      attemptToken: resumeState.attempt_token
    });
    setCurrentIndex(clampedIndex);
    setFocusedOptionIndex(0);
    setAnswers(resumeState.answers);
  };

  const handleStartOver = () => {
    clearResumeState(test.testId, test.slug);
    setResumeState(null);
    setAttempt(null);
    setCurrentIndex(0);
    setFocusedOptionIndex(0);
    setAnswers({});
    void startNewAttempt();
  };

  if (totalQuestions === 0) {
    return (
      <FlowFrame className="py-8">
        <Card className={FLOW_CARD_CLASS_NAME}>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em]">
                Quiz Factory
              </Badge>
              <Badge className="w-fit border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
                Setup needed
              </Badge>
            </div>
            <CardTitle className="text-3xl">{test.title}</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              This test has no questions yet.
            </CardDescription>
          </CardHeader>
        </Card>
      </FlowFrame>
    );
  }

  const handleBack = () => {
    if (isCompleting) {
      return;
    }

    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    if (!canProceed || isLastQuestion) {
      return;
    }

    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
  };

  const handleFinish = async () => {
    if (!attempt || !canProceed || isCompleting) {
      return;
    }

    setError(null);
    setIsCompleting(true);

    try {
      await completeAttempt({
        test_id: test.testId,
        session_id: attempt.sessionId,
        attempt_token: attempt.attemptToken
      });
      clearResumeState(test.testId, test.slug);
      setResumeState(null);
      const previewResponse = await fetch("/api/test/score-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          test_id: test.testId,
          session_id: attempt.sessionId,
          attempt_token: attempt.attemptToken,
          answers
        })
      });
      if (!previewResponse.ok) {
        throw new Error("Score preview failed.");
      }
      router.push(`/t/${test.slug}/preview`);
    } catch (error) {
      logger.warn({ error }, "app/t/[slug]/run/test-runner.tsx fallback handling failed");
      setError("Unable to finish the test. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) {
      return;
    }

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId
    }));
  };

  const handleOptionsKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!currentQuestion || currentQuestion.options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocusedOption(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusedOption(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const focusedOption = currentQuestion.options[focusedOptionIndex];
      if (focusedOption) {
        handleSelectOption(focusedOption.id);
      }
    }
  };

  if (!attempt) {
    return (
      <FlowFrame className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 md:py-8">
        <Card className={FLOW_CARD_CLASS_NAME}>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em]">
                Quiz Factory
              </Badge>
              <Badge className="w-fit border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
                Free preview first
              </Badge>
            </div>
            <CardTitle className="text-3xl">{test.title}</CardTitle>
            <CardDescription className="text-base leading-relaxed text-muted-foreground">
              {test.intro}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-6">
            {!isResumeLoaded ? (
              <p className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Checking saved progress...
              </p>
            ) : null}

            {isResumeLoaded && resumeState ? (
              <div className="space-y-4 rounded-xl border border-[hsl(var(--brand-teal)/0.35)] bg-[hsl(var(--brand-teal)/0.08)] p-4">
                <p className="text-sm text-foreground/90">
                  Saved progress found. Continue where you left off or restart from the
                  beginning.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" className="w-full sm:min-w-36 sm:w-auto" onClick={handleContinue}>
                    Continue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:min-w-36 sm:w-auto"
                    onClick={handleStartOver}
                    disabled={isStarting}
                  >
                    {isStarting ? "Starting..." : "Start over"}
                  </Button>
                </div>
              </div>
            ) : null}

            {isResumeLoaded && !resumeState ? (
              <Button
                type="button"
                className="w-full sm:min-w-40 sm:w-auto"
                onClick={handleStart}
                disabled={isStarting}
                data-testid="runner-start-button"
              >
                {isStarting ? "Starting..." : "Start test"}
              </Button>
            ) : null}
          </CardContent>
          {error ? (
            <CardFooter className="pt-0">
              <p className={ERROR_BANNER_CLASS_NAME} data-testid="runner-error-banner">
                {error}
              </p>
            </CardFooter>
          ) : null}
        </Card>
      </FlowFrame>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <FlowFrame className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 md:py-8">
      <Card className={FLOW_CARD_CLASS_NAME}>
        <CardHeader className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="uppercase tracking-[0.18em]">
                Quiz Factory
              </Badge>
              <Badge className="border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
                Question {currentIndex + 1} of {totalQuestions}
              </Badge>
            </div>
            <Badge
              variant="outline"
              className="border-[hsl(var(--brand-teal)/0.45)] bg-[hsl(var(--brand-teal)/0.08)] text-[hsl(var(--brand-teal))]"
            >
              {progressValue}% complete
            </Badge>
          </div>
          <CardTitle className="text-2xl leading-tight sm:text-3xl">{test.title}</CardTitle>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-foreground/90">Current step</p>
              <p className="text-muted-foreground">
                {currentIndex + 1} / {totalQuestions}
              </p>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--brand-teal)/0.18)]"
              role="progressbar"
              aria-label="Test progress"
              aria-valuenow={progressValue}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-6 pt-6">
          <h2 id={questionHeadingId} className="text-xl leading-snug text-foreground">
            {currentQuestion.prompt}
          </h2>
          <ul
            className="space-y-3"
            role="radiogroup"
            aria-labelledby={questionHeadingId}
            onKeyDown={handleOptionsKeyDown}
          >
            {currentQuestion.options.map((option, optionIndex) => {
              const isSelected = selectedOption === option.id;
              const isFocused = focusedOptionIndex === optionIndex;

              return (
                <li key={option.id}>
                  <Button
                    ref={(element) => {
                      optionRefs.current[optionIndex] = element;
                    }}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isFocused ? 0 : -1}
                    data-testid={optionIndex === 0 ? "runner-first-option" : undefined}
                    className={cn(
                      "h-auto w-full justify-start whitespace-normal rounded-xl border px-4 py-4 text-left text-base leading-relaxed",
                      "transition-all duration-150",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "border-border/80 bg-white/90 hover:border-[hsl(var(--brand-terracotta)/0.6)] hover:bg-[hsl(var(--brand-terracotta)/0.12)]",
                      isFocused ? "ring-2 ring-ring ring-offset-2" : null
                    )}
                    onFocus={() => {
                      setFocusedOptionIndex(optionIndex);
                    }}
                    onClick={() => {
                      handleSelectOption(option.id);
                    }}
                  >
                    {option.label}
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
        <CardFooter className="sticky bottom-0 z-20 flex flex-wrap gap-3 border-t border-border/70 bg-card/95 p-4 pt-4 backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <Button
            variant="outline"
            type="button"
            className="min-w-[7.5rem] flex-1 sm:flex-none"
            onClick={handleBack}
            disabled={currentIndex === 0 || isCompleting}
          >
            Back
          </Button>
          <Button
            type="button"
            className="min-w-[8.5rem] flex-1 sm:flex-none"
            onClick={() => {
              if (isLastQuestion) {
                void handleFinish();
                return;
              }

              handleNext();
            }}
            disabled={!canProceed || isCompleting}
            data-testid={isLastQuestion ? "runner-finish-button" : "runner-next-button"}
          >
            {isLastQuestion ? (isCompleting ? "Finishing..." : "Finish") : "Next"}
          </Button>
        </CardFooter>
        {error ? (
          <CardFooter className="pt-0">
            <p className={ERROR_BANNER_CLASS_NAME} data-testid="runner-error-banner">
              {error}
            </p>
          </CardFooter>
        ) : null}
      </Card>
    </FlowFrame>
  );
}
