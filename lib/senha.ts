/**
 * Validação de senha forte para o Confirma.
 * Regras:
 *  - Mínimo 8 caracteres
 *  - Pelo menos 1 letra maiúscula
 *  - Pelo menos 1 caractere especial (!@#$%&*?-_+=...)
 *  - Pelo menos 1 número (recomendado, não obrigatório por enquanto)
 */

export const SENHA_PADRAO_PRIMEIRO_ACESSO = "Confiance2026";

export type ResultadoValidacaoSenha = {
  ok: boolean;
  erros: string[];
};

export function validarSenhaForte(senha: string): ResultadoValidacaoSenha {
  const erros: string[] = [];
  if (!senha || senha.length < 8) {
    erros.push("Mínimo de 8 caracteres");
  }
  if (!/[A-ZÁÉÍÓÚÃÕÇÊÔÂ]/.test(senha)) {
    erros.push("Pelo menos 1 letra maiúscula");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(senha)) {
    erros.push("Pelo menos 1 caractere especial (ex: ! @ # $ %)");
  }
  return { ok: erros.length === 0, erros };
}

export function descreveRegrasSenha(): string[] {
  return [
    "Mínimo de 8 caracteres",
    "Pelo menos 1 letra maiúscula",
    "Pelo menos 1 caractere especial",
  ];
}
