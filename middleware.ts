import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { isVerificationTokenValid, VERIFICATION_COOKIE } from "@/lib/security/session-cookie";

function verificationRequired() {
  return process.env.SESSION_VERIFICATION_REQUIRED === "true"
    && process.env.SESSION_VERIFICATION_ENABLED !== "false"
    && Boolean(
      process.env.RESEND_API_KEY
      && process.env.SECURITY_ALERT_EMAIL
      && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth/");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (user && verificationRequired()) {
    const verified = await isVerificationTokenValid(request.cookies.get(VERIFICATION_COOKIE)?.value, user.id);
    const onVerifyPage = pathname === "/verify";
    const gateExempt = onVerifyPage || pathname === "/security";

    if (!verified && !gateExempt) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify";
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      return copyCookies(response, NextResponse.redirect(url));
    }

    if (verified && onVerifyPage) {
      const target = new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url);
      return copyCookies(response, NextResponse.redirect(target));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)"],
};
