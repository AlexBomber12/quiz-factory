import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

type SearchParams = {
  error?: string | string[];
};

type LoginPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const getErrorCode = async (
  params: LoginPageProps["searchParams"]
): Promise<string | null> => {
  if (!params) {
    return null;
  }

  const resolved = await Promise.resolve(params);
  const value = resolved.error;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const getErrorMessage = (code: string | null): string | null => {
  switch (code) {
    case "missing_token":
      return "A token is required.";
    case "invalid_token":
      return "Token is invalid.";
    case "server_misconfigured":
      return "Server is missing admin auth configuration.";
    default:
      return null;
  }
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const existingSession = await verifyAdminSession(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );
  if (existingSession) {
    redirect("/admin");
  }

  const errorCode = await getErrorCode(searchParams);
  const errorMessage = getErrorMessage(errorCode);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Admin login</CardTitle>
          <CardDescription>
            Enter an admin or editor token to start a signed session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" method="post" action="/api/admin/login">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="token">
                Access token
              </label>
              <input
                id="token"
                name="token"
                type="password"
                required
                autoComplete="off"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              />
            </div>
            {errorMessage ? (
              <p className="text-sm text-red-700" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
