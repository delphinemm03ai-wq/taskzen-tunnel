import { NextResponse } from "next/server";

export interface SuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

export function success<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

function makeError(code: string, defaultStatus: number) {
  return (message: string, status = defaultStatus): NextResponse<ErrorResponse> =>
    NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export const errors = {
  badRequest: makeError("bad_request", 400),
  unauthorized: makeError("unauthorized", 401),
  notFound: makeError("not_found", 404),
  tooManyRequests: makeError("too_many_requests", 429),
  internal: makeError("internal_error", 500),
};
