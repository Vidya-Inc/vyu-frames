export const dynamic = 'force-dynamic';

export async function POST() {
  return Response.json(
    { success: true },
    { headers: { 'Set-Cookie': 'vf_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' } }
  );
}
