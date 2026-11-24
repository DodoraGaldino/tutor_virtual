import os
import time
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import groq

load_dotenv()

app = FastAPI(
    title="Tutor Virtual PET-BSI",
    description="Assistente educacional com IA para Sistemas de Informação",
    version="1.2.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Permite requisições apenas das origens autorizadas (Vercel e desenvolvimento local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tutorvirtual-five.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Configuração do Groq
chave = os.getenv("GROQ_API_KEY")
cliente = Groq(api_key=chave) if chave else None

MODELOS_TEXTO = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]
MODELO_VISAO = "qwen/qwen3.8-27b"
TENTATIVAS = 3

_MODELO_INDISPONIVEL = {404}
_MODELO_DECOMMISSIONED_MSG = "model_decommissioned"


def _modelo_fora_de_servico(erro: groq.APIStatusError) -> bool:
    if erro.status_code in _MODELO_INDISPONIVEL:
        return True
    if erro.status_code == 400 and _MODELO_DECOMMISSIONED_MSG in str(erro):
        return True
    return False


SYSTEM_PROMPT = (
    "Você é o Tutor Virtual do PET-BSI, especializado em Sistemas de Informação. "
    "Explique matemática, cálculo, algoritmos, banco de dados, redes e engenharia de software "
    "de forma didática, clara, detalhada e acolhedora. "
    "Caso o aluno envie uma imagem (foto de exercício, diagrama ou código), "
    "analise cuidadosamente cada elemento visual, resolva passo a passo e dê explicações completas. "
    "IMPORTANTE PARA FÓRMULAS MATEMÁTICAS: "
    "Sempre utilize notação LaTeX padrão com cifrões para que sejam renderizadas corretamente: "
    "use $fórmula$ para expressões inline e $$fórmula$$ em linhas separadas para equações destacadas. "
    "Nunca use colchetes [ ] ou parênteses ( ) puros sem cifrão para delimitar fórmulas. "
    "REGRA SOBRE RECEITAS E CULINÁRIA: "
    "Você é um tutor acadêmico e é estritamente proibido ensinar ou fornecer receitas culinárias. "
    "A ÚNICA E EXCLUSIVA EXCEÇÃO É RISOTTO: se o aluno pedir especificamente uma receita de risotto ou como preparar risotto, "
    "você TEM PERMISSÃO TOTAL para ensinar passo a passo a fazer risotto de forma detalhada e acolhedora. "
    "Para QUALQUER OUTRA receita culinária (bolos, massas, carnes, doces, etc.), recuse educadamente "
    "explicando que seu foco é acadêmico em Sistemas de Informação e que a única exceção gastronômica que você pode ensinar é risotto. "
    "DIRETRIZ DE ESTILO: Não utilize emojis em nenhuma resposta."
)


def gerar_resposta(pergunta: str, imagem: Optional[str] = None) -> str:
    if not cliente:
        raise RuntimeError("GROQ_API_KEY não configurada no ambiente.")

    # Se houver imagem em base64, utiliza o modelo de visão multimodal
    if imagem and imagem.startswith("data:image"):
        texto_usuario = (
            pergunta.strip()
            if pergunta.strip()
            else "Por favor, analise a imagem enviada, resolva e explique o conteúdo detalhadamente."
        )

        for tentativa in range(TENTATIVAS):
            try:
                res = cliente.chat.completions.create(
                    model=MODELO_VISAO,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": texto_usuario},
                                {"type": "image_url", "image_url": {"url": imagem}},
                            ],
                        },
                    ],
                    temperature=0.3,
                    max_tokens=2048,
                )
                return res.choices[0].message.content
            except (groq.RateLimitError, groq.APIConnectionError):
                if tentativa < TENTATIVAS - 1:
                    time.sleep(2 ** tentativa)
                    continue
                raise
            except groq.APIStatusError as erro:
                if erro.status_code >= 500 and tentativa < TENTATIVAS - 1:
                    time.sleep(2 ** tentativa)
                    continue
                raise
        raise RuntimeError("Não foi possível processar a imagem no momento.")

    # Se for apenas texto, tenta a lista com fallback
    ultimo_erro: Optional[Exception] = None
    for modelo in MODELOS_TEXTO:
        for tentativa in range(TENTATIVAS):
            try:
                res = cliente.chat.completions.create(
                    model=modelo,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": pergunta},
                    ],
                    temperature=0.4,
                )
                return res.choices[0].message.content
            except (groq.RateLimitError, groq.APIConnectionError):
                if tentativa < TENTATIVAS - 1:
                    time.sleep(2 ** tentativa)
                    continue
                raise
            except groq.APIStatusError as erro:
                if _modelo_fora_de_servico(erro):
                    ultimo_erro = erro
                    break
                if erro.status_code >= 500 and tentativa < TENTATIVAS - 1:
                    time.sleep(2 ** tentativa)
                    continue
                raise

    raise RuntimeError(
        f"Nenhum modelo disponível pôde responder. Último erro: {ultimo_erro}"
    )


# Schema da requisição
class Mensagem(BaseModel):
    pergunta: str = ""
    imagem: Optional[str] = None


@app.get("/")
def raiz():
    return {"status": "ok"}


@app.post("/chat")
def conversar(mensagem: Mensagem):
    try:
        resposta = gerar_resposta(mensagem.pergunta, mensagem.imagem)
        return {
            "pergunta_recebida": mensagem.pergunta,
            "resposta": resposta
        }
    except Exception as erro:
        print("ERRO:", repr(erro))
        return {
            "erro": repr(erro)
        }


import json
import sqlite3

def init_db():
    with sqlite3.connect("historico.db") as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS historico_usuario (
                user_id TEXT PRIMARY KEY,
                dados TEXT,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

init_db()


class HistoricoPayload(BaseModel):
    conversations: list


@app.get("/history/{user_id}")
def obter_historico(user_id: str):
    try:
        with sqlite3.connect("historico.db") as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT dados FROM historico_usuario WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            if row and row[0]:
                return {"conversations": json.loads(row[0])}
            return {"conversations": []}
    except Exception as e:
        return {"conversations": [], "erro": str(e)}


@app.post("/history/{user_id}")
def salvar_historico(user_id: str, payload: HistoricoPayload):
    try:
        with sqlite3.connect("historico.db") as conn:
            conn.execute(
                "INSERT OR REPLACE INTO historico_usuario (user_id, dados, atualizado_em) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (user_id, json.dumps(payload.conversations))
            )
        return {"status": "ok"}
    except Exception as e:
        return {"status": "erro", "detalhe": str(e)}
