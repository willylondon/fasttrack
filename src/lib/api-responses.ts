import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function readJsonBody(request: Request) {
  try {
    return { data: await request.json(), error: null };
  } catch {
    return { data: null, error: "Invalid JSON." };
  }
}

export function getZodMessage(error: ZodError, fallback = "Invalid request.") {
  return error.issues[0]?.message ?? fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

export function getErrorStatus(message: string) {
  return message.toLowerCase().includes("not found") ? 404 : 400;
}

export function jsonMessage(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}
