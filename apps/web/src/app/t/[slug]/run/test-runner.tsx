"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { LocalizedQuestion } from "../../../../lib/content/types";
import {
  completeAttempt,
  emitAttemptEntryPageView,
  startAttempt
} from "../../../../lib/product/client";

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

export default function TestRunnerClient({ test }: RunnerProps) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQuestions = test.questions.length;

  if (totalQuestions === 0) {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>{test.title}</h1>
          <p>This test has no questions yet.</p>
        </header>
      </section>
    );
  }

  const currentQuestion = test.questions[currentIndex];
  const selectedOption = answers[currentQuestion.id];
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const canProceed = Boolean(selectedOption);

  const handleStart = async () => {
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

      void emitAttemptEntryPageView({
        test_id: test.testId,
        session_id: response.session_id,
        attempt_token: response.attempt_token,
        page_type: "attempt_entry",
        page_url: window.location.pathname
      }).catch(() => null);
    } catch {
      setError("Unable to start the test. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleBack = () => {
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
      router.push(`/t/${test.slug}/preview`);
    } catch {
      setError("Unable to finish the test. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSelectOption = (optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId
    }));
  };

  if (!attempt) {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>{test.title}</h1>
          <p>{test.intro}</p>
        </header>

        <div className="cta-row">
          <button
            className="primary-button"
            type="button"
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? "Starting..." : "Start test"}
          </button>
        </div>

        {error ? <p className="status-message">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{test.title}</h1>
      </header>

      <div className="runner-card">
        <div className="runner-progress">
          Question {currentIndex + 1} / {totalQuestions}
        </div>
        <h2 className="runner-question">{currentQuestion.prompt}</h2>
        <ul className="option-list" role="radiogroup" aria-label="Answer options">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOption === option.id;
            return (
              <li key={option.id}>
                <button
                  className="option-button"
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-selected={isSelected}
                  onClick={() => handleSelectOption(option.id)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="runner-nav">
          <button
            className="secondary-button"
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0 || isCompleting}
          >
            Back
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={isLastQuestion ? handleFinish : handleNext}
            disabled={!canProceed || isCompleting}
          >
            {isLastQuestion ? (isCompleting ? "Finishing..." : "Finish") : "Next"}
          </button>
        </div>
      </div>

      {error ? <p className="status-message">{error}</p> : null}
    </section>
  );
}
