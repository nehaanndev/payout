import { NextResponse } from 'next/server';

export function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export function handleOptions() {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}


