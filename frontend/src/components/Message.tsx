"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";

export type Sender = "user" | "bot" | "error";

export interface MessageData {
  id: string;
  sender: Sender;
  text: string;
  image?: string;
  timestamp?: string;
}

interface MessageProps {
  message: MessageData;
}

/**
 * Normaliza e prepara o texto gerado pela IA:
 * 1. Converte delimitadores LaTeX brutos (\[ \], \( \), [ \comando ], (\comando)) para $ e $$
 * 2. Garante que listas e títulos tenham as quebras de linha corretas para o Markdown renderizar perfeitamente
 */
function cleanAndFormatText(text: string): string {
  if (!text) return "";

  let result = text;

  // ── 1. Normalização de Delimitadores Matemáticos (LaTeX) ──
  // Converte \[ ... \] em $$ ... $$
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n\n$$\n${math.trim()}\n$$\n\n`);

  // Converte \( ... \) em $ ... $
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // Se a IA gerou fórmulas multilinha com $ isolado em linhas próprias ($ \n ... \n $),
  // converte para $$ para que o remark-math processe como display math em bloco
  result = result.replace(/(?:^|\n)\s*\$\s*\n([\s\S]*?)\n\s*\$\s*(?:\n|$)/g, (_, math) => `\n\n$$\n${math.trim()}\n$$\n\n`);

  // Garante que blocos de fórmulas $$ não fiquem colados no texto
  // OBS: Em JavaScript, SEMPRE use função no replace para não colapsar '$$' em '$'
  result = result.replace(/([^\n])\s*\$\$/g, (_, before) => `${before}\n\n$$`);
  result = result.replace(/\$\$\s*([^\n$])/g, (_, after) => `$$\n\n${after}`);

  // ── 2. Proteção de Tabelas Markdown: Substitui '|' dentro de fórmulas por '\vert ' ──
  // Em tabelas Markdown (GFM), a barra '|' é o separador de colunas da tabela. Se uma fórmula
  // contiver '|' (como valor absoluto ex: -\ln|\cos x| ou \big|), o Markdown corta a coluna.
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => `$$${math.replace(/\|/g, "\\vert ")}$$`);
  result = result.replace(/\$([^\$\n]+)\$/g, (_, math) => `$${math.replace(/\|/g, "\\vert ")}$`);

  // ── 3. Normalização de Listas e Estruturas Markdown ──
  // Garante quebra dupla antes de listas numeradas
  result = result.replace(/([^\n])\n([0-9]+\.\s)/g, "$1\n\n$2");

  // Garante quebra dupla antes de listas com marcadores
  result = result.replace(/([^\n])\n([-*]\s)/g, "$1\n\n$2");

  // Garante que títulos com # tenham espaço
  result = result.replace(/^([#]{1,6})([^#\s])/gm, "$1 $2");

  // Garante quebra de linha antes de títulos se estiver colado no parágrafo anterior
  result = result.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

  return result;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-[#d8cde9] bg-[#1a1728] shadow-sm">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#251f38] border-b border-[#3b3252] text-xs font-mono text-[#d4c8e8]">
        <span className="uppercase tracking-wider font-semibold text-white">
          {language || "código"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs hover:bg-[#3b3252] text-white transition-all cursor-pointer"
          title="Copiar código"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400 font-medium">Copiado!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="text-xs sm:text-sm font-mono overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "1rem",
            backgroundColor: "transparent",
            fontSize: "0.85rem",
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  table({ children }) {
    return (
      <div className="table-wrapper">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          {children}
        </table>
      </div>
    );
  },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const isInline = !match;
    const content = String(children).replace(/\n$/, "");

    if (isInline) {
      return (
        <code
          className="bg-[#201535] text-[#d8b4fe] font-medium px-1.5 py-0.5 rounded-md font-mono text-[12px] sm:text-xs border border-[#392454] break-all inline-block my-0.5"
          {...props}
        >
          {children}
        </code>
      );
    }

    return <CodeBlock language={match[1]} value={content} />;
  },
  p({ children }) {
    return <p className="mb-2.5 last:mb-0 leading-relaxed text-[#ede6f8] text-[14px] sm:text-[14.5px]">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-outside ml-4 sm:ml-6 mb-2.5 space-y-1 text-[#e2d9f3]">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-outside ml-4 sm:ml-6 mb-2.5 space-y-1 text-[#e2d9f3]">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed pl-1 text-[#e2d9f3] text-[13.5px] sm:text-[14px]">{children}</li>;
  },
  strong({ children }) {
    return <strong className="font-bold text-white">{children}</strong>;
  },
  h1({ children }) {
    return <h1 className="text-lg sm:text-2xl font-black mt-4 mb-2 text-[#f5f3ff] border-b border-[#2e1d44] pb-1 uppercase tracking-tight">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base sm:text-xl font-bold mt-3.5 mb-1.5 text-[#d8b4fe] tracking-tight">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm sm:text-lg font-semibold mt-3 mb-1 text-[#c084fc]">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-[#8b5cf6] bg-[#181026] px-4 py-2.5 rounded-r-lg my-3 italic text-[#d4c8e8]">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="border-[#291b3e] my-4" />;
  },
};

export default function Message({ message }: MessageProps) {
  const isUser = message.sender === "user";
  const isError = message.sender === "error";
  const [copiedText, setCopiedText] = useState(false);

  const formattedContent = isUser ? message.text : cleanAndFormatText(message.text);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div
      className={`group flex w-full mb-3.5 sm:mb-5 animate-fade-in ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex gap-2 sm:gap-3.5 w-full ${
          isUser
            ? "justify-end max-w-[88%] sm:max-w-[80%]"
            : "justify-start max-w-full sm:max-w-[88%] md:max-w-[82%]"
        } ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Avatar */}
        {isUser ? (
          <div className="flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-[#3b1763] border border-[#6b21a8] flex items-center justify-center text-white shadow-md select-none mt-0.5">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#e9d5ff]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        ) : (
          <div className="flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-[#23143d] border border-[#4c2882] flex items-center justify-center text-[#c084fc] shadow-md select-none mt-0.5 font-black text-[10px] sm:text-xs tracking-tighter">
            PET
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 px-0.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#a78bfa]">
              {isUser ? "Você" : isError ? "Erro" : "TUTOR PET-BSI"}
            </span>
            {message.timestamp && (
              <span className="text-[10px] sm:text-[11px] text-[#7d6f92] font-medium">{message.timestamp}</span>
            )}
          </div>

          <div
            className={`relative px-3 sm:px-5 py-3 sm:py-4 rounded-2xl text-[14px] sm:text-[14.5px] leading-relaxed shadow-lg transition-all ${
              isUser
                ? "bg-[#581c87] text-white rounded-tr-xs font-medium border border-[#7c3aed]/40 shadow-[#581c87]/20"
                : isError
                ? "bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-tl-xs"
                : "bg-[#140e20] border border-[#2b1c40] text-[#e8e0f5] rounded-tl-xs prose-pet shadow-md"
            }`}
          >
            {/* Imagem enviada pelo aluno (se houver) */}
            {message.image && (
              <div className="mb-3 overflow-hidden rounded-xl border border-white/20 bg-black/40 max-w-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.image}
                  alt="Imagem enviada pelo aluno"
                  className="max-h-72 w-auto object-contain rounded-xl"
                />
              </div>
            )}

            {isUser ? (
              <div className="whitespace-pre-wrap break-words">{message.text}</div>
            ) : (
              <div className="break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                  rehypePlugins={[[rehypeKatex, { strict: false }]]}
                  components={markdownComponents}
                >
                  {formattedContent}
                </ReactMarkdown>
              </div>
            )}

            {!isUser && (
              <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-[#241738] opacity-75 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1.5 text-xs text-[#a78bfa] hover:text-white px-2 py-0.5 rounded transition cursor-pointer font-semibold"
                  title="Copiar texto da resposta"
                >
                  {copiedText ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copiar resposta</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
