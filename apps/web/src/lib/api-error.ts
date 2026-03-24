import { ZodError } from "zod";
import { InvalidDocumentOrgIdsError, QuoteMissingTaxSnapshotError } from "@vbt/core";
import { TenantError } from "./tenant";
import { tenantErrorStatus } from "./tenant";
import { RateLimitExceededError } from "./rate-limit";

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details: Array<{ path?: string; message: string }>;
  };
};

/**
 * Normalize unknown errors into a consistent API error shape.
 * Handles RateLimitExceededError, TenantError, Zod validation errors, Prisma errors, and generic Error.
 */
export function normalizeApiError(error: unknown): { status: number; payload: ApiErrorPayload } {
  if (error instanceof RateLimitExceededError) {
    return {
      status: 429,
      payload: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: error.message,
          details: [],
        },
      },
    };
  }

  if (error instanceof InvalidDocumentOrgIdsError) {
    return {
      status: 400,
      payload: {
        error: {
          code: "INVALID_DOCUMENT_ORG_IDS",
          message: error.message,
          details: [],
        },
      },
    };
  }

  if (error instanceof QuoteMissingTaxSnapshotError) {
    return {
      status: 422,
      payload: {
        error: {
          code: error.code,
          message: error.message,
          details: error.quoteId ? [{ path: "quoteId", message: error.quoteId }] : [],
        },
      },
    };
  }

  if (error instanceof TenantError) {
    return {
      status: tenantErrorStatus(error),
      payload: {
        error: {
          code: error.code,
          message: error.message,
          details: [],
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      payload: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join(".") || undefined,
            message: issue.message,
          })),
        },
      },
    };
  }

  // Prisma errors (from @prisma/client)
  const prismaError = error as { code?: string; meta?: unknown; message?: string };
  if (prismaError && typeof prismaError === "object" && "code" in prismaError) {
    const code = prismaError.code as string;
    if (code === "P2021" || code === "P2022") {
      return {
        status: 503,
        payload: {
          error: {
            code: "DB_SCHEMA_OUT_OF_DATE",
            message:
              "The database is missing tables or columns required by this feature. Apply pending Prisma migrations on this environment (for example: pnpm exec prisma migrate deploy).",
            details: [],
          },
        },
      };
    }
    const status = code === "P2002" ? 409 : code === "P2025" ? 404 : 400;
    const message =
      code === "P2002"
        ? "A record with this value already exists"
        : code === "P2025"
          ? "Record not found"
          : prismaError.message ?? "Database error";
    return {
      status,
      payload: {
        error: {
          code: "DB_ERROR",
          message,
          details: [],
        },
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      payload: {
        error: {
          code: "INTERNAL_ERROR",
          message: process.env.NODE_ENV === "production" ? "An error occurred" : error.message,
          details: [],
        },
      },
    };
  }

  return {
    status: 500,
    payload: {
      error: {
        code: "UNKNOWN_ERROR",
        message: "An unexpected error occurred",
        details: [],
      },
    },
  };
}
