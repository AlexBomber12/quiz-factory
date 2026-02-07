import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../../components/ui/card";
import {
  buildImportPreview,
  getImportById,
  isValidImportId
} from "../../../../lib/admin/imports";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ id: string }> => {
  return Promise.resolve(params);
};

export default async function AdminImportPreviewPage({ params }: PageProps) {
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

  const record = await getImportById(importId);
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
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">status: {record.status}</Badge>
          <span className="text-sm text-muted-foreground">
            Created by: <code>{record.created_by ?? "unknown"}</code>
          </span>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/imports/new">Upload another bundle</Link>
          </Button>
        </CardContent>
      </Card>

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
