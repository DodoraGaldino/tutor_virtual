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

/** Callback chamado quando o servidor está acordando (cold start detectado). */
export type OnColdStartCallback = (tentativa: number) => void;

const MAX_TENTATIVAS = 4;
// Delays em ms entre tentativas: 5s, 10s, 15s
const DELAYS_RETRY = [5000, 10000, 15000];

/**
 * Verifica se a resposta é HTML (indica que o Render ainda está acordando).
 */
function isColdStart(res: Response): boolean {
  const contentType = res.headers.get("content-type") || "";
  return !contentType.includes("application/json");
}

/**
 * Aguarda um tempo em ms.
 */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia uma pergunta (e opcionalmente imagem em base64) para o backend FastAPI.
 * Retenta automaticamente em caso de cold start (servidor hibernado no Render),
 * chamando `onColdStart` a cada tentativa para que a UI mostre feedback.
 */
export async function enviarPergunta(
  pergunta: string,
  imagem?: string | null,
  onColdStart?: OnColdStartCallback
): Promise<ApiResponse> {
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta,
          imagem: imagem ?? null,
        }),
      });

      // Cold start: Render ainda acordando, retornou HTML em vez de JSON
      if (isColdStart(res)) {
        if (tentativa < MAX_TENTATIVAS - 1) {
          onColdStart?.(tentativa + 1);
          await esperar(DELAYS_RETRY[tentativa] ?? 15000);
          continue;
        }
        return {
          erro: "O servidor demorou muito para responder. Tente novamente em alguns instantes.",
        };
      }

      const data: ApiResponse = await res.json();
      return data;
    } catch (err) {
      // Falha de rede — pode ser cold start também
      if (tentativa < MAX_TENTATIVAS - 1) {
        onColdStart?.(tentativa + 1);
        await esperar(DELAYS_RETRY[tentativa] ?? 15000);
        continue;
      }
      const msg = err instanceof Error ? err.message : "Erro de conexão";
      return { erro: `Não foi possível conectar ao servidor: ${msg}` };
    }
  }

  return { erro: "Não foi possível conectar ao servidor após várias tentativas." };
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
