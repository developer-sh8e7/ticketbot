import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'csrf_failed'
  | 'internal_error';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(code: ApiErrorCode, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export function internalError() {
  return fail('internal_error', 'Internal server error', 500);
}
