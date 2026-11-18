import os
import time
import groq
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


chave = os.getenv("GROQ_API_KEY")
if not chave:
    raise RuntimeError("GROQ_API_KEY não encontrada. Confira o arquivo .env")

cliente = Groq(api_key=chave)

# Modelos disponíveis
MODELOS_TEXTO = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]

# Modelo multimodal com suporte a leitura de imagens
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
    "Caso o aluno envie uma imagem (como uma foto de exercício, diagrama ou código), "
    "analise cuidadosamente cada elemento visual, resolva passo a passo e dê explicações completas. "
    "IMPORTANTE: Sempre utilize notação LaTeX padrão com cifrões para fórmulas matemáticas: "
    "use $fórmula$ para expressões inline e $$fórmula$$ em linhas separadas para equações destacadas. "
    "Nunca use colchetes [ ] ou parênteses ( ) puros sem cifrão para delimitar fórmulas."
)


def _chamar_com_imagem(pergunta: str, imagem_url: str) -> str:
    """Processa pergunta acompanhada de imagem usando o modelo multimodal."""
    texto_usuario = pergunta.strip() if pergunta.strip() else "Por favor, analise a imagem enviada, resolva e explique o conteúdo detalhadamente."

    for tentativa in range(TENTATIVAS):
        try:
            resposta = cliente.chat.completions.create(
                model=MODELO_VISAO,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": texto_usuario},
                            {"type": "image_url", "image_url": {"url": imagem_url}},
                        ],
                    },
                ],
                temperature=0.3,
                max_tokens=2048,
            )
            return resposta.choices[0].message.content

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


def _chamar_texto(modelo: str, pergunta: str) -> str:
    """Chama um modelo de texto."""
    for tentativa in range(TENTATIVAS):
        try:
            resposta = cliente.chat.completions.create(
                model=modelo,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": pergunta},
                ],
                temperature=0.4,
            )
            return resposta.choices[0].message.content

        except (groq.RateLimitError, groq.APIConnectionError):
            if tentativa < TENTATIVAS - 1:
                time.sleep(2 ** tentativa)
                continue
            raise
        except groq.APIStatusError as erro:
            if _modelo_fora_de_servico(erro):
                raise
            if erro.status_code >= 500 and tentativa < TENTATIVAS - 1:
                time.sleep(2 ** tentativa)
                continue
            raise


def gerar_resposta(pergunta: str, imagem: str | None = None) -> str:
    """
    Gera resposta para a dúvida do aluno.
    Se uma imagem em formato Data URL (base64) for fornecida, utiliza o modelo de visão.
    """
    if imagem and imagem.startswith("data:image"):
        return _chamar_com_imagem(pergunta, imagem)

    ultimo_erro: Exception | None = None
    for modelo in MODELOS_TEXTO:
        try:
            return _chamar_texto(modelo, pergunta)
        except groq.APIStatusError as erro:
            if _modelo_fora_de_servico(erro):
                ultimo_erro = erro
                continue
            raise

    raise RuntimeError(
        f"Nenhum modelo disponível pôde responder. Último erro: {ultimo_erro}"
    )
