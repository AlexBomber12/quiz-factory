import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  MAX_IMPORT_FILES,
  MAX_IMPORT_TOTAL_BYTES
} from "@/lib/admin/imports";
import { ADMIN_CSRF_FORM_FIELD } from "@/lib/admin/csrf";
import { getAdminCsrfTokenForRender } from "@/lib/admin/csrf_server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";

type SearchParams = {
  error?: string | string[];
  detail?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const readErrorState = async (
  params: PageProps["searchParams"]
): Promise<{ code: string | null; detail: string | null }> => {
  if (!params) {
    return { code: null, detail: null };
  }

  const resolved = await Promise.resolve(params);
  return {
    code: asSingleValue(resolved.error),
    detail: asSingleValue(resolved.detail)
  };
};

const errorMessage = (code: string | null, detail: string | null): string | null => {
  switch (code) {
    case "invalid_form_data":
      return "Upload request is invalid. Submit files using multipart form data.";
    case "invalid_csrf":
      return "Upload was rejected by CSRF protection. Refresh and try again.";
    case "rate_limited":
      return `Too many upload attempts. Retry in ${detail ?? "a few"} seconds.`;
    case "missing_files":
      return "No files were uploaded. Choose one or more markdown files.";
    case "too_many_files":
      return `Too many files. Maximum allowed is ${MAX_IMPORT_FILES}.`;
    case "invalid_file_type":
      return `Only .md files are allowed${detail ? `: ${detail}` : ""}.`;
    case "invalid_filename":
      return `Invalid file name${detail ? `: ${detail}` : ""}. Expected source.<locale>.md.`;
    case "locale_not_allowed":
      return `Locale is not allowed${detail ? `: ${detail}` : ""}.`;
    case "duplicate_locale":
      return `Duplicate locale uploaded${detail ? `: ${detail}` : ""}.`;
    case "total_bytes_exceeded":
      return `Upload size limit exceeded. Max total bytes: ${MAX_IMPORT_TOTAL_BYTES}.`;
    case "db_error":
      return "Failed to create import in database.";
    case "unauthorized":
      return "You are not authorized to upload imports.";
    default:
      return null;
  }
};

export default async function AdminImportsNewPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const { code, detail } = await readErrorState(searchParams);
  const message = errorMessage(code, detail);
  const csrfToken = await getAdminCsrfTokenForRender();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>New import bundle</CardTitle>
          <CardDescription>
            Upload source markdown files named <code>source.&lt;locale&gt;.md</code> (example:{" "}
            <code>source.en.md</code>, <code>source.pt-BR.md</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            method="post"
            action="/api/admin/imports"
            encType="multipart/form-data"
            className="space-y-4"
          >
            <input type="hidden" name={ADMIN_CSRF_FORM_FIELD} value={csrfToken} />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="files">
                Source files
              </label>
              <input
                id="files"
                name="files"
                type="file"
                required
                multiple
                accept=".md,text/markdown"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              />
              <p className="text-xs text-muted-foreground">
                Max files: {MAX_IMPORT_FILES}. Max total upload size: {MAX_IMPORT_TOTAL_BYTES} bytes.
              </p>
            </div>

            {message ? (
              <p className="text-sm text-red-700" role="alert">
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit">Upload bundle</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin">Back to admin</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
