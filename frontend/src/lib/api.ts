/**
 * api.ts
 * Comunicação com a API FastAPI no Render.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_URL
    : "https://tutor-virtual-q3hd.onrender.com";

export interface ApiSuccessResponse {
  pergunta_recebida: string;
  resposta: string;
}

export interface ApiErrorResponse {
  erro: string;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

/**
 * Envia uma pergunta (e opcionalmente imagem em base64) para o backend FastAPI.
 */
export async function enviarPergunta(
  pergunta: string,
  imagem?: string | null
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pergunta,
        imagem: imagem ?? null,
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return {
        erro: "O servidor está inicializando. Por favor, aguarde alguns instantes e envie novamente.",
      };
    }

    const data: ApiResponse = await res.json();
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de conexão";
    return { erro: `Não foi possível conectar ao servidor: ${msg}` };
  }
}

/**
 * Salva o histórico de conversas do usuário na nuvem associado à conta Google.
 */
export async function salvarHistoricoNuvem(userId: string, conversations: unknown[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/history/${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations }),
    });
    return res.ok;
  } catch (err) {
    console.warn("Falha ao salvar histórico na nuvem:", err);
    return false;
  }
}

/**
 * Carrega o histórico de conversas da conta Google armazenado na nuvem.
 */
export async function carregarHistoricoNuvem(userId: string): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${API_URL}/history/${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.conversations) && data.conversations.length > 0) {
        return data.conversations;
      }
    }
  } catch (err) {
    console.warn("Falha ao buscar histórico na nuvem:", err);
  }
  return null;
}
