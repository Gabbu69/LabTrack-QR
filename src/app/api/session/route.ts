import { apiRoute } from "@/lib/api";

export const GET = apiRoute({ allowPasswordChange: true }, async () => new Response(null, { status: 204 }));
