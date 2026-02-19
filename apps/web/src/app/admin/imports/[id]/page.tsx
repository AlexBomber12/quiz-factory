import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  buildImportPreview,
  getDraftByImportId,
  getImportById,
  isValidImportId,
  type ImportDraftRecord
} from "@/lib/admin/imports";
import { ADMIN_CSRF_FORM_FIELD } from "@/lib/admin/csrf";
import { getAdminCsrfTokenForRender } from "@/lib/admin/csrf_server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";
import { validateTestSpec } from "@/lib/content/validate";

type SearchParams = {
  error?: string | string[];
  detail?: string | string[];
  convert?: string | string[];
  version?: string | string[];
};

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: SearchParams | Promise<SearchParams>;
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ id: string }> => {
  return Promise.resolve(params);
};

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const readPageState = async (
  params: PageProps["searchParams"]
): Promise<{
  errorCode: string | null;
  detail: string | null;
  convert: string | null;
  version: string | null;
}> => {
  if (!params) {
    return {
      errorCode: null,
      detail: null,
      convert: null,
      version: null
    };
  }

  const resolved = await Promise.resolve(params);
  return {
    errorCode: asSingleValue(resolved.error),
    detail: asSingleValue(resolved.detail),
    convert: asSingleValue(resolved.convert),
    version: asSingleValue(resolved.version)
  };
};

const errorMessage = (errorCode: string | null, detail: string | null): string | null => {
  switch (errorCode) {
    case "unauthorized":
      return "You are not authorized to convert imports.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh and retry.";
    case "invalid_import_id":
      return "Import ID is invalid.";
    case "import_not_found":
      return "Import was not found.";
    case "unsupported_format":
      return detail ?? "Only universal_human_v1 imports can be converted in this step.";
    case "validation_failed":
      return detail ?? "Converted spec failed validation.";
    case "slug_conflict":
      return detail ?? "Slug is already used by a different test.";
    case "test_conflict":
      return detail ?? "test_id conflicts with an existing test.";
    case "conversion_failed":
      return detail ?? "Converter failed. Check input format and retry.";
    case "db_error":
      return detail ?? "Database write failed while creating draft.";
    default:
      return null;
  }
};

const convertMessage = (convert: string | null, version: string | null): string | null => {
  if (convert === "created") {
    return `Draft version ${version ?? ""} created successfully.`.trim();
  }

  if (convert === "reused") {
    return `Draft version ${version ?? ""} already existed for this import and checksum.`.trim();
  }

  return null;
};

type DraftPreview = {
  localeRows: Array<{ locale: string; title: string; reportTitle: string; paywallHeadline: string }>;
  questionCount: number;
  scales: string[];
  promptRows: Array<{ id: string; prompt: string }>;
};

const buildDraftPreview = (draft: ImportDraftRecord): DraftPreview | null => {
  try {
    const spec = validateTestSpec(draft.spec_json, draft.test_id);
    const localeRows = Object.entries(spec.locales)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([locale, strings]) => ({
        locale,
        title: strings?.title ?? "",
        reportTitle: strings?.report_title ?? "",
        paywallHeadline: strings?.paywall_headline ?? ""
      }));

    const promptRows = spec.questions.slice(0, 5).map((question) => ({
      id: question.id,
      prompt: question.prompt.en ?? ""
    }));

    return {
      localeRows,
      questionCount: spec.questions.length,
      scales: [...spec.scoring.scales],
      promptRows
    };
  } catch {
    return null;
  }
};

export default async function AdminImportPreviewPage({ params, searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedParams = await resolveParams(params);
  const importId = resolvedParams.id;
  if (!isValidImportId(importId)) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Import not found</CardTitle>
            <CardDescription>Import ID is invalid.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const [record, pageState] = await Promise.all([
    getImportById(importId),
    readPageState(searchParams)
  ]);

  if (!record) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Import not found</CardTitle>
            <CardDescription>No import exists for this ID.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/imports/new">Create a new import</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const preview = buildImportPreview(record.files_json);
  const draft = await getDraftByImportId(record.id);
  const draftPreview = draft ? buildDraftPreview(draft) : null;
  const csrfToken = await getAdminCsrfTokenForRender();

  const conversionError = errorMessage(pageState.errorCode, pageState.detail);
  const conversionSuccess = convertMessage(pageState.convert, pageState.version);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Import preview</CardTitle>
          <CardDescription className="space-y-1">
            <span className="block">
              Import ID: <code>{record.id}</code>
            </span>
            <span className="block">
              Created at: <code>{record.created_at}</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">status: {record.status}</Badge>
            <span className="text-sm text-muted-foreground">
              Created by: <code>{record.created_by ?? "unknown"}</code>
            </span>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/imports/new">Upload another bundle</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <form method="post" action={`/api/admin/imports/${record.id}`}>
              <input type="hidden" name={ADMIN_CSRF_FORM_FIELD} value={csrfToken} />
              <Button type="submit">Convert to draft version</Button>
            </form>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin">Back to admin</Link>
            </Button>
          </div>

          {conversionError ? (
            <p className="text-sm text-red-700" role="alert">
              {conversionError}
            </p>
          ) : null}

          {conversionSuccess ? (
            <p className="text-sm text-green-700" role="status">
              {conversionSuccess}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft version</CardTitle>
            <CardDescription>
              Read-only preview of the converted draft stored in <code>test_versions</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                Draft ID: <code>{draft.id}</code>
              </p>
              <p>
                Version: <code>{draft.version}</code>
              </p>
              <p>
                test_id: <code>{draft.test_id}</code>
              </p>
              <p>
                slug: <code>{draft.slug}</code>
              </p>
              <p>
                checksum: <code className="break-all">{draft.checksum}</code>
              </p>
              <p>
                created_at: <code>{draft.created_at}</code>
              </p>
            </div>

            {draftPreview ? (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <p>
                    Questions: <code>{draftPreview.questionCount}</code>
                  </p>
                  <p>
                    Scales: <code>{draftPreview.scales.join(", ")}</code>
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-2 font-semibold">Locale</th>
                        <th className="px-2 py-2 font-semibold">Title</th>
                        <th className="px-2 py-2 font-semibold">Report title</th>
                        <th className="px-2 py-2 font-semibold">Paywall headline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftPreview.localeRows.map((row) => (
                        <tr className="border-b align-top" key={row.locale}>
                          <td className="px-2 py-2">
                            <code>{row.locale}</code>
                          </td>
                          <td className="px-2 py-2">{row.title}</td>
                          <td className="px-2 py-2">{row.reportTitle}</td>
                          <td className="px-2 py-2">{row.paywallHeadline}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1">
                  <p className="font-medium">Question preview (EN, first 5)</p>
                  {draftPreview.promptRows.length === 0 ? (
                    <p className="text-muted-foreground">No questions available.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5">
                      {draftPreview.promptRows.map((row) => (
                        <li key={row.id}>
                          <code>{row.id}</code>: {row.prompt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                Draft exists, but its spec preview could not be parsed.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No draft version yet</CardTitle>
            <CardDescription>
              Use "Convert to draft version" to generate and validate <code>spec_json</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Warnings</CardTitle>
          <CardDescription>Validation warnings based on locale coverage and hash uniqueness.</CardDescription>
        </CardHeader>
        <CardContent>
          {preview.warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warnings.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            Locales, hash, guessed title, and escaped markdown excerpts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">Locale</th>
                  <th className="px-2 py-2 font-semibold">Filename</th>
                  <th className="px-2 py-2 font-semibold">Size (bytes)</th>
                  <th className="px-2 py-2 font-semibold">SHA-256</th>
                  <th className="px-2 py-2 font-semibold">Title guess</th>
                  <th className="px-2 py-2 font-semibold">Excerpt</th>
                </tr>
              </thead>
              <tbody>
                {preview.files.map((file) => (
                  <tr className="border-b align-top" key={`${file.locale}:${file.sha256}`}>
                    <td className="px-2 py-2">
                      <code>{file.locale}</code>
                    </td>
                    <td className="px-2 py-2">{file.filename}</td>
                    <td className="px-2 py-2">{file.size_bytes}</td>
                    <td className="px-2 py-2">
                      <code className="break-all text-xs">{file.sha256}</code>
                    </td>
                    <td className="px-2 py-2">{file.title_guess}</td>
                    <td className="px-2 py-2">
                      <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
                        {file.excerpt}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
