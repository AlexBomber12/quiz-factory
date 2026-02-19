"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { AlertAiInsightRecord, AlertInstanceRecord } from "@/lib/alerts/types";

type InsightAction = {
  title: string;
  steps: string[];
  expected_effect: string;
  risk_level: "low" | "medium" | "high";
};

type InsightPayload = {
  summary: string;
  root_cause_hypotheses: string[];
  actions: InsightAction[];
};

type ActionCenterClientProps = {
  alerts: AlertInstanceRecord[];
  initialSelectedAlertId: string | null;
  initialInsight: AlertAiInsightRecord | null;
  csrfToken: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const parseInsightPayload = (value: unknown): InsightPayload | null => {
  if (!isRecord(value)) {
    return null;
  }

  const summary = typeof value.summary === "string" ? value.summary : null;
  const rootCauseHypotheses = Array.isArray(value.root_cause_hypotheses)
    ? value.root_cause_hypotheses.filter((item): item is string => typeof item === "string")
    : null;
  const actions = Array.isArray(value.actions)
    ? value.actions
        .map((action) => {
          if (!isRecord(action)) {
            return null;
          }

          const title = typeof action.title === "string" ? action.title : null;
          const steps = Array.isArray(action.steps)
            ? action.steps.filter((step): step is string => typeof step === "string")
            : null;
          const expectedEffect =
            typeof action.expected_effect === "string" ? action.expected_effect : null;
          const riskLevel =
            action.risk_level === "low" || action.risk_level === "medium" || action.risk_level === "high"
              ? action.risk_level
              : null;

          if (!title || !steps || !expectedEffect || !riskLevel) {
            return null;
          }

          return {
            title,
            steps,
            expected_effect: expectedEffect,
            risk_level: riskLevel
          };
        })
        .filter((action): action is InsightAction => action !== null)
    : null;

  if (!summary || !rootCauseHypotheses || !actions || actions.length === 0) {
    return null;
  }

  return {
    summary,
    root_cause_hypotheses: rootCauseHypotheses,
    actions
  };
};

const toLabel = (value: string): string => {
  return value.replace(/_/g, " ");
};

const riskVariant = (risk: InsightAction["risk_level"]): "secondary" | "outline" | "destructive" => {
  if (risk === "high") {
    return "destructive";
  }
  if (risk === "medium") {
    return "secondary";
  }
  return "outline";
};

export default function ActionCenterClient({
  alerts,
  initialSelectedAlertId,
  initialInsight,
  csrfToken
}: ActionCenterClientProps) {
  const fallbackSelectedAlertId = alerts[0]?.id ?? null;
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(
    initialSelectedAlertId ?? fallbackSelectedAlertId
  );
  const [insightByAlertId, setInsightByAlertId] = useState<Record<string, AlertAiInsightRecord | null>>(() => {
    if (initialSelectedAlertId) {
      return {
        [initialSelectedAlertId]: initialInsight
      };
    }
    return {};
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedAlert = useMemo(() => {
    return alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  }, [alerts, selectedAlertId]);

  const selectedInsight = selectedAlertId ? (insightByAlertId[selectedAlertId] ?? null) : null;
  const selectedInsightPayload = parseInsightPayload(selectedInsight?.actions_json);

  useEffect(() => {
    if (!selectedAlertId) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(insightByAlertId, selectedAlertId)) {
      return;
    }

    let cancelled = false;
    setLoadingInsight(true);
    setLoadError(null);

    void fetch(`/api/admin/alerts/${encodeURIComponent(selectedAlertId)}/insight`, {
      method: "GET",
      headers: {
        accept: "application/json"
      }
    })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 404) {
          setInsightByAlertId((current) => ({
            ...current,
            [selectedAlertId]: null
          }));
          return;
        }

        const payload = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          const detail = typeof payload.detail === "string" ? payload.detail : null;
          const error = typeof payload.error === "string" ? payload.error : "insight_load_failed";
          throw new Error(detail ? `${error}: ${detail}` : error);
        }

        const insight = isRecord(payload.insight) ? (payload.insight as AlertAiInsightRecord) : null;
        setInsightByAlertId((current) => ({
          ...current,
          [selectedAlertId]: insight
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unable to load insight.";
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInsight(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAlertId, insightByAlertId]);

  const handleGenerateInsight = async (): Promise<void> => {
    if (!selectedAlertId || isGenerating) {
      return;
    }

    setLoadError(null);
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/admin/alerts/${encodeURIComponent(selectedAlertId)}/insight`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-admin-csrf-token": csrfToken
        },
        body: JSON.stringify({
          csrf_token: csrfToken,
          force: Boolean(selectedInsight)
        })
      });

      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        const detail = typeof payload.detail === "string" ? payload.detail : null;
        const error = typeof payload.error === "string" ? payload.error : "insight_generation_failed";
        throw new Error(detail ? `${error}: ${detail}` : error);
      }

      const insight = isRecord(payload.insight) ? (payload.insight as AlertAiInsightRecord) : null;
      setInsightByAlertId((current) => ({
        ...current,
        [selectedAlertId]: insight
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate insight.";
      setLoadError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Instances</CardTitle>
          <CardDescription>Select an alert to inspect AI recommendations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alert instances available.</p>
          ) : null}
          {alerts.map((alert) => {
            const selected = alert.id === selectedAlertId;
            return (
              <button
                className={`w-full rounded border px-3 py-2 text-left text-sm transition-colors ${
                  selected ? "border-primary bg-primary/10" : "hover:bg-muted"
                }`}
                key={alert.id}
                onClick={() => setSelectedAlertId(alert.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{alert.rule_name}</span>
                  <Badge variant="outline">{alert.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {alert.fired_at} · {toLabel(alert.rule_type)} · {alert.status}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insight Panel</CardTitle>
          <CardDescription>
            Generate an explanation and action plan for the selected alert instance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedAlert ? (
            <div className="rounded border bg-muted/40 p-3 text-sm">
              <p>
                <span className="font-medium">Rule:</span> {selectedAlert.rule_name}
              </p>
              <p>
                <span className="font-medium">Rule type:</span> {toLabel(selectedAlert.rule_type)}
              </p>
              <p>
                <span className="font-medium">Fired at:</span> {selectedAlert.fired_at}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select an alert to view insights.</p>
          )}

          <div className="flex items-center gap-2">
            <Button disabled={!selectedAlertId || isGenerating || loadingInsight} onClick={handleGenerateInsight}>
              {isGenerating ? "Generating insight..." : selectedInsight ? "Regenerate insight" : "Generate insight"}
            </Button>
            {loadingInsight ? <span className="text-xs text-muted-foreground">Loading insight...</span> : null}
          </div>

          {loadError ? (
            <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </p>
          ) : null}

          {!selectedInsight && !loadingInsight ? (
            <p className="text-sm text-muted-foreground">
              No cached insight yet. Generate one for this alert instance.
            </p>
          ) : null}

          {selectedInsight && selectedInsightPayload ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Why this alert fired</h3>
                <p className="mt-1 text-sm">{selectedInsightPayload.summary}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Root-cause hypotheses</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {selectedInsightPayload.root_cause_hypotheses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Recommended actions</h3>
                {selectedInsightPayload.actions.map((action) => (
                  <div className="rounded border p-3" key={`${action.title}-${action.risk_level}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{action.title}</p>
                      <Badge variant={riskVariant(action.risk_level)}>{action.risk_level}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{action.expected_effect}</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                      {action.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
