"use client";

export default function TypingIndicator() {
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
