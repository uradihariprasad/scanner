import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/upstox-api";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/token
 * Save and validate Upstox access token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, sessionId } = body;

    if (!accessToken || !sessionId) {
      return NextResponse.json(
        { error: "Access token and session ID are required" },
        { status: 400 }
      );
    }

    // Clean the token
    const cleanToken = accessToken.trim();
    
    if (cleanToken.length < 10) {
      return NextResponse.json(
        { error: "Access token appears to be invalid (too short)" },
        { status: 400 }
      );
    }

    console.log(`[Auth] Validating token for session: ${sessionId.substring(0, 20)}...`);

    // Validate token with Upstox
    const validationResult = await validateToken(cleanToken);
    
    if (!validationResult.valid) {
      console.error(`[Auth] Token validation failed:`, validationResult.error);
      return NextResponse.json(
        { 
          error: validationResult.error || "Invalid access token",
          details: validationResult.details,
          hint: "Make sure you're using a valid, non-expired Upstox access token"
        },
        { status: 401 }
      );
    }

    console.log(`[Auth] Token validated successfully, saving to database...`);

    // Upsert session
    try {
      const existing = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.sessionId, sessionId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(userSessions)
          .set({
            accessToken: cleanToken,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(userSessions.sessionId, sessionId));
      } else {
        await db.insert(userSessions).values({
          sessionId,
          accessToken: cleanToken,
          isActive: true,
        });
      }
      
      console.log(`[Auth] Session saved successfully`);
    } catch (dbError) {
      console.error(`[Auth] Database error:`, dbError);
      return NextResponse.json(
        { error: "Failed to save session. Database error." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Token validated and saved" });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate token", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/token?sessionId=xxx
 * Check if session has a valid token
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ authenticated: false });
    }

    const sessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].isActive) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true });
  } catch (error) {
    console.error("Token check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * DELETE /api/auth/token
 * Logout - deactivate session
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (sessionId) {
      await db
        .update(userSessions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userSessions.sessionId, sessionId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
