import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const ROTAS_PUBLICAS = ["/login", "/cadastro", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Atualiza a sessão (refresh do token se necessário)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const ehRotaPublica = ROTAS_PUBLICAS.some((p) =>
    url.pathname.startsWith(p)
  );

  // Sem usuário e em rota privada → manda pro login
  if (!user && !ehRotaPublica) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Com usuário e em rota de login → manda pro dashboard
  if (user && ehRotaPublica) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
