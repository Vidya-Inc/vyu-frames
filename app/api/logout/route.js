export const dynamic = 'force-dynamic';

// The admin token lives in the browser tab's memory; "logging out" is simply
// the client discarding it.
export async function POST() {
  return Response.json({ success: true });
}
