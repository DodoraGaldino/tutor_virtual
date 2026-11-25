"use client";

interface TypingIndicatorProps {
  coldStart?: boolean;
  tentativa?: number;
}

export default function TypingIndicator({ coldStart = false, tentativa = 1 }: TypingIndicatorProps) {
  if (coldStart) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl rounded-tl-xs bg-[#160f24] border border-[#2d1e44] w-fit shadow-md max-w-xs sm:max-w-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-bounce" />
          </div>
          <span className="text-xs text-amber-300 font-semibold tracking-wide pl-1">
            Aguardando o servidor acordar...
          </span>
        </div>
        <p className="text-[11px] text-[#9b89b4] leading-relaxed">
          O servidor ficou inativo e está sendo inicializado. Tentativa {tentativa} de 3 — isso pode levar
          até 30 segundos. Sua mensagem será enviada automaticamente.
        </p>
        <div className="w-full bg-[#1e1333] rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full animate-pulse"
            style={{ width: `${Math.min((tentativa / 3) * 100, 95)}%`, transition: "width 0.5s ease" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-xs bg-[#160f24] border border-[#2d1e44] w-fit shadow-md">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#c084fc] animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#6b21a8] animate-bounce" />
      </div>
      <span className="text-xs text-[#c4b5fd] font-semibold tracking-wide pl-1">
        Processando resposta com IA...
      </span>
    </div>
  );
}
