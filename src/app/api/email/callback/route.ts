import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveGmailTokens } from "@/domain/email/gmail.service";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL("/email/conectar?error=access_denied", req.url));
    }

    // Verificar state CSRF
    const cookieStore = await cookies();
    const savedState = cookieStore.get("gmail_oauth_state")?.value;
    if (!state || state !== savedState) {
      return NextResponse.redirect(new URL("/email/conectar?error=invalid_state", req.url));
    }

    cookieStore.delete("gmail_oauth_state");

    if (!code) {
      return NextResponse.redirect(new URL("/email/conectar?error=no_code", req.url));
    }

    // Intercambiar code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Gmail token exchange error:", err);
      return NextResponse.redirect(new URL("/email/conectar?error=token_exchange", req.url));
    }

    const tokens = await tokenRes.json();
    await saveGmailTokens(session.userId, tokens);

    return NextResponse.redirect(new URL("/email?connected=1", req.url));
  } catch (error) {
    console.error("Gmail callback error:", error);
    return NextResponse.redirect(new URL("/email/conectar?error=server_error", req.url));
  }
}
