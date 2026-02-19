import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeString } from "@/lib/utils/strings";

type GeneratedSummary = {
  headline: string;
  bullets: string[];
};

type GeneratedSection = {
  id: string;
  title: string;
  body: string;
  bullets: string[];
};

type GeneratedActionPlanItem = {
  title: string;
  steps: string[];
};

export type GeneratedReportJson = {
  report_title: string;
  summary: GeneratedSummary;
  sections: GeneratedSection[];
  action_plan: GeneratedActionPlanItem[];
  disclaimers: string[];
};

type GeneratedReportProps = {
  reportJson: GeneratedReportJson;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};


const normalizeStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized.length === value.length ? normalized : null;
};

const normalizeSummary = (value: unknown): GeneratedSummary | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const headline = normalizeString(record.headline);
  const bullets = normalizeStringArray(record.bullets);
  if (!headline || !bullets) {
    return null;
  }

  return {
    headline,
    bullets
  };
};

const normalizeSection = (value: unknown): GeneratedSection | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const id = normalizeString(record.id);
  const title = normalizeString(record.title);
  const body = normalizeString(record.body);
  const bullets = normalizeStringArray(record.bullets);
  if (!id || !title || !body || !bullets) {
    return null;
  }

  return {
    id,
    title,
    body,
    bullets
  };
};

const normalizeActionPlanItem = (value: unknown): GeneratedActionPlanItem | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const title = normalizeString(record.title);
  const steps = normalizeStringArray(record.steps);
  if (!title || !steps) {
    return null;
  }

  return {
    title,
    steps
  };
};

export const parseGeneratedReportJson = (value: unknown): GeneratedReportJson | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const reportTitle = normalizeString(record.report_title);
  const summary = normalizeSummary(record.summary);

  const rawSections = Array.isArray(record.sections) ? record.sections : null;
  const sections = rawSections?.map((entry) => normalizeSection(entry)) ?? null;

  const rawActionPlan = Array.isArray(record.action_plan) ? record.action_plan : null;
  const actionPlan = rawActionPlan?.map((entry) => normalizeActionPlanItem(entry)) ?? null;

  const disclaimers = normalizeStringArray(record.disclaimers);

  if (!reportTitle || !summary || !sections || !actionPlan || !disclaimers) {
    return null;
  }

  if (sections.some((entry) => !entry) || actionPlan.some((entry) => !entry)) {
    return null;
  }

  return {
    report_title: reportTitle,
    summary,
    sections: sections as GeneratedSection[],
    action_plan: actionPlan as GeneratedActionPlanItem[],
    disclaimers
  };
};

export default function GeneratedReport({ reportJson }: GeneratedReportProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="generated-report-card border-border/60 shadow-sm print:shadow-none">
        <CardHeader className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            Generated summary
          </Badge>
          <CardTitle className="text-2xl">{reportJson.summary.headline}</CardTitle>
        </CardHeader>
        {reportJson.summary.bullets.length > 0 ? (
          <CardContent className="pt-0">
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
              {reportJson.summary.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      {reportJson.sections.map((section) => (
        <Card
          key={section.id}
          className="generated-report-card border-border/60 shadow-sm print:shadow-none"
        >
          <CardHeader className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              Section
            </Badge>
            <CardTitle className="text-2xl">{section.title}</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {section.body}
            </CardDescription>
          </CardHeader>
          {section.bullets.length > 0 ? (
            <CardContent className="pt-0">
              <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                {section.bullets.map((bullet) => (
                  <li key={`${section.id}-${bullet}`}>{bullet}</li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      ))}

      <Card className="generated-report-card border-border/60 shadow-sm print:shadow-none">
        <CardHeader className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            Action plan
          </Badge>
          <CardTitle className="text-2xl">Next actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-4">
            {reportJson.action_plan.map((item) => (
              <section key={item.title} className="flex flex-col gap-2">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                {item.steps.length > 0 ? (
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
                    {item.steps.map((step) => (
                      <li key={`${item.title}-${step}`}>{step}</li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="generated-report-card border-dashed border-border/80 bg-muted/20 shadow-none">
        <CardHeader className="space-y-2">
          <Badge variant="outline" className="w-fit">
            Disclaimers
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {reportJson.disclaimers.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {reportJson.disclaimers.map((disclaimer) => (
                <li key={disclaimer}>{disclaimer}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No disclaimers available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
