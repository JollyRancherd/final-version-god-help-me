import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

// Service-role client — used only to verify JWTs server-side
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Middleware: verifies the Bearer JWT from Supabase and attaches
 * req.user = { id: supabase_user_uuid } so all existing route handlers
 * keep working with no other changes needed.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "You need to log in first." });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
  }

  // Attach user to req — keeps existing `getUserId(req)` working
  (req as any).user = { id: user.id };
  next();
};

export function toSafeUser(user: { id: string; email?: string | null }) {
  return { id: user.id, username: user.email ?? user.id };
}
