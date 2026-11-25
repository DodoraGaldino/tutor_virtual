"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Message, { MessageData, Sender } from "./Message";
import TypingIndicator from "./TypingIndicator";
import { enviarPergunta, salvarHistoricoNuvem, carregarHistoricoNuvem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export interface Conversation {
  id: string;
  title: string;
  messages: MessageData[];
  createdAt: number;
}

const STORAGE_KEY = "pet_bsi_chat_conversations";
const ACTIVE_CONV_KEY = "pet_bsi_active_chat_id";

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getTimeString(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface SuggestionPill {
  label: string;
  prompt: string;
}

const TOP_PILLS: SuggestionPill[] = [
  {
    label: "Resolver Integral",
    prompt: "Como calcular a integral indefinida de cos(x) passo a passo?",
  },
  {
    label: "Normalização 3NF",
    prompt: "Explique o que é a 3ª Forma Normal (3NF) com um exemplo prático de tabela.",
  },
  {
    label: "Algoritmos Big-O",
    prompt: "Explique a diferença de complexidade Big-O entre Busca Linear e Busca Binária.",
  },
  {
    label: "Modelo OSI",
    prompt: "Como funciona o modelo OSI comparado ao TCP/IP na prática?",
  },
];

interface FeatureCard {
  iconType: "math" | "db" | "code";
  badge: string;
  title: string;
  description: string;
  prompt: string;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    iconType: "math",
    badge: "Calcular ↗",
    title: "Cálculo & Matemática",
    description: "Integrais, derivadas, limites e fórmulas resolvidos passo a passo em LaTeX.",
    prompt: "Me ajude a resolver e entender o cálculo de derivadas e integrais passo a passo.",
  },
  {
    iconType: "db",
    badge: "Aprender ↗",
    title: "Banco de Dados & SQL",
    description: "Modelagem ER, SQL avançado, 1NF/2NF/3NF e otimização de consultas.",
    prompt: "Explique as formas normais em Banco de Dados com exemplos práticos.",
  },
  {
    iconType: "code",
    badge: "Explorar ↗",
    title: "Algoritmos & Código",
    description: "Estruturas de dados, complexidade Big-O, grafos e código limpo.",
    prompt: "Quais os algoritmos de ordenação mais eficientes e qual a complexidade de cada um?",
  },
];

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "exemplo-calculo",
    title: "Integral de cos(x)",
    createdAt: Date.now() - 1000 * 60 * 60,
    messages: [
      {
        id: "msg-1",
        sender: "user",
        text: "Como calcular a integral de cos(x)?",
        timestamp: "Ontem",
      },
      {
        id: "msg-2",
        sender: "bot",
        text: "Para calcular a integral indefinida de $\\cos(x)$ em relação a $x$:\n\n$$\\int \\cos(x)\\,dx = \\sin(x) + C$$\n\nOnde $C$ é a constante de integração. Isso ocorre porque a derivada de $\\sin(x)$ é exatamente $\\cos(x)$!",
        timestamp: "Ontem",
      },
    ],
  },
  {
    id: "exemplo-bd",
    title: "Normalização 3NF",
    createdAt: Date.now() - 1000 * 60 * 120,
    messages: [
      {
        id: "msg-3",
        sender: "user",
        text: "O que é a 3ª Forma Normal (3NF)?",
        timestamp: "Ontem",
      },
      {
        id: "msg-4",
        sender: "bot",
        text: "A **3ª Forma Normal (3NF)** elimina dependências transitivas. Uma tabela está na 3NF se:\n1. Já estiver na **2NF**;\n2. Nenhum atributo não-chave depender de outro atributo não-chave.\n\n*Regra de ouro*: Cada coluna deve depender da chave, de toda a chave e de nada além da chave!",
        timestamp: "Ontem",
      },
    ],
  },
];

export default function Chat() {
  const { user, setIsProfileOpen } = useAuth();

  // Chave de histórico vinculada à conta Google atual
  const userId = user?.googleId || user?.id || user?.email || null;
  const storageKey = userId ? `pet_bsi_history_${userId}` : STORAGE_KEY;
  const activeKey = userId ? `pet_bsi_active_chat_${userId}` : ACTIVE_CONV_KEY;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [coldStartTentativa, setColdStartTentativa] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [imageErrorToast, setImageErrorToast] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const footerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // No desktop (>= 768px), abre a sidebar por padrão ao carregar
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  // Carrega histórico quando o usuário (ou ausência dele) mudar
  useEffect(() => {
    let isCancelled = false;

    async function carregarHistorico() {
      try {
        const localSaved = localStorage.getItem(storageKey);
        let convList: Conversation[] = [];

        if (localSaved !== null) {
          try {
            convList = JSON.parse(localSaved);
          } catch {
            convList = [];
          }
        } else if (!userId) {
          convList = INITIAL_CONVERSATIONS;
          localStorage.setItem(storageKey, JSON.stringify(INITIAL_CONVERSATIONS));
        }

        setConversations(convList);

        const lastActive = localStorage.getItem(activeKey);
        if (lastActive && convList.some((c) => c.id === lastActive)) {
          setActiveId(lastActive);
        } else if (convList.length > 0) {
          setActiveId(convList[0].id);
        } else {
          setActiveId(null);
        }

        // Se o usuário estiver conectado com a conta Google e for o primeiro acesso neste navegador, restaura da nuvem
        if (userId) {
          const cloudConvs = await carregarHistoricoNuvem(userId);
          if (!isCancelled && cloudConvs && Array.isArray(cloudConvs)) {
            if (localSaved === null && cloudConvs.length > 0) {
              setConversations(cloudConvs as Conversation[]);
              localStorage.setItem(storageKey, JSON.stringify(cloudConvs));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar histórico", err);
      } finally {
        if (!isCancelled) {
          setIsLoaded(true);
        }
      }
    }

    carregarHistorico();

    return () => {
      isCancelled = true;
    };
  }, [userId, storageKey, activeKey]);

  // Salva histórico no localStorage e sincroniza na conta Google
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
      if (activeId) {
        localStorage.setItem(activeKey, activeId);
      } else {
        localStorage.removeItem(activeKey);
      }

      if (userId) {
        const timer = setTimeout(() => {
          salvarHistoricoNuvem(userId, conversations);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.error("Falha ao salvar no localStorage", err);
    }
  }, [conversations, activeId, isLoaded, userId, storageKey, activeKey]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const currentMessages = activeConversation ? activeConversation.messages : [];

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isLoading]);

  // Foco
  useEffect(() => {
    if (currentMessages.length > 0) {
      footerTextareaRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  }, [activeId, currentMessages.length]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageErrorToast("Por favor, selecione uma imagem válida (PNG, JPG, WEBP).");
      setTimeout(() => setImageErrorToast(null), 3500);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageName(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed && !selectedImage) return;
      if (isLoading) return;

      const userMessage: MessageData = {
        id: genId(),
        sender: "user",
        text: trimmed || "(Imagem enviada para análise)",
        image: selectedImage ?? undefined,
        timestamp: getTimeString(),
      };

      const imagePayload = selectedImage;

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      if (footerTextareaRef.current) {
        footerTextareaRef.current.style.height = "auto";
      }
      setSelectedImage(null);
      setImageName(null);
      setIsLoading(true);

      let targetId = activeId;

      if (!targetId || !conversations.some((c) => c.id === targetId)) {
        const newTitle = trimmed
          ? trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "")
          : "Análise de Imagem";

        const newConv: Conversation = {
          id: genId(),
          title: newTitle,
          createdAt: Date.now(),
          messages: [userMessage],
        };

        targetId = newConv.id;
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(targetId);
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? { ...c, messages: [...c.messages, userMessage] }
              : c
          )
        );
      }

      try {
        const res = await enviarPergunta(trimmed, imagePayload, (tentativa) => {
          setColdStartTentativa(tentativa);
        });

        let botReply: MessageData;

        if ("resposta" in res) {
          botReply = {
            id: genId(),
            sender: "bot",
            text: res.resposta,
            timestamp: getTimeString(),
          };
        } else {
          botReply = {
            id: genId(),
            sender: "error",
            text: `Erro ao consultar tutor:\n\n\`${res.erro}\``,
            timestamp: getTimeString(),
          };
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? { ...c, messages: [...c.messages, botReply] }
              : c
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro de conexão";
        const errorMessage: MessageData = {
          id: genId(),
          sender: "error",
          text: `**Não foi possível conectar ao backend.**\n\n\`${msg}\``,
          timestamp: getTimeString(),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? { ...c, messages: [...c.messages, errorMessage] }
              : c
          )
        );
      } finally {
        setIsLoading(false);
        setColdStartTentativa(0);
        setTimeout(() => {
          if (footerTextareaRef.current) {
            footerTextareaRef.current.focus();
          } else {
            textareaRef.current?.focus();
          }
        }, 50);
      }
    },
    [isLoading, selectedImage, activeId, conversations]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setActiveId(null);
    setInput("");
    setSelectedImage(null);
    setImageName(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setInput("");
    setSelectedImage(null);
    setImageName(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteModalId(id);
  };

  const confirmDeleteConversation = () => {
    if (!deleteModalId) return;
    const targetId = deleteModalId;
    setDeleteModalId(null);

    // Se for apagar todo o histórico
    if (targetId === "all") {
      setConversations([]);
      setActiveId(null);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      if (footerTextareaRef.current) {
        footerTextareaRef.current.style.height = "auto";
      }
      setSelectedImage(null);
      setImageName(null);
      try {
        localStorage.setItem(storageKey, JSON.stringify([]));
        localStorage.removeItem(activeKey);
      } catch (err) {
        console.error("Erro ao limpar histórico do localStorage", err);
      }
      if (userId) {
        salvarHistoricoNuvem(userId, []);
      }
      return;
    }

    // 1. Remove da memória
    const updated = conversations.filter((c) => c.id !== targetId);
    setConversations(updated);

    // 2. Gravação IMEDIATA e definitiva no localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      if (activeId === targetId) {
        const nextActive = updated.length > 0 ? updated[0].id : null;
        setActiveId(nextActive);
        setInput("");
        setSelectedImage(null);
        setImageName(null);
        if (nextActive) {
          localStorage.setItem(activeKey, nextActive);
        } else {
          localStorage.removeItem(activeKey);
        }
      }
    } catch (err) {
      console.error("Erro ao remover do localStorage", err);
    }

    // 3. Sincronização IMEDIATA na nuvem da Conta Google
    if (userId) {
      salvarHistoricoNuvem(userId, updated);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const hasMessages = currentMessages.length > 0;
  const canSend = (input.trim().length > 0 || selectedImage !== null) && !isLoading;
  const firstName = user?.name ? user.name.split(" ")[0] : "aluno";

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-hidden bg-[#090611] text-[#ede9f6] font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Backdrop escuro quando o menu lateral (histórico & conta) estiver aberto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu lateral"
        />
      )}

      {/* ── PAINEL LATERAL DESLIZANTE (HISTÓRICO + LOGIN COM GOOGLE) ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col flex-shrink-0 bg-[#0e0a18] text-[#ede9f6] border-r border-[#26173f] overflow-hidden select-none transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? "w-80 max-w-[88vw] translate-x-0 shadow-2xl md:shadow-none"
            : "-translate-x-full md:translate-x-0 md:w-0 w-0 pointer-events-none md:pointer-events-auto"
        }`}
      >
        <div className="p-4 sm:p-5 flex flex-col h-full justify-between">
          <div className="flex flex-col min-h-0 flex-1">
            {/* Topo do Painel com Branding e Botão Fechar */}
            <div className="flex items-center justify-between mb-4 px-1 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#201338] border border-[#3e2466] text-[#c084fc] flex items-center justify-center font-black text-sm shadow-md shadow-[#7c3aed]/15">
                  ✦
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-sm tracking-tight text-white leading-none">
                    PET-BSI
                  </span>
                  <span className="text-[9px] font-bold tracking-widest text-[#a78bfa] uppercase mt-0.5">
                    Tutor Virtual
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#1b122c] hover:bg-[#25183d] text-slate-400 hover:text-white transition flex items-center justify-center cursor-pointer border border-[#2e1d48]"
                title="Fechar menu"
                aria-label="Fechar menu"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* SEÇÃO 1: LOGIN COM GOOGLE (EM DESTAQUE NO TOPO DA TELA PUXADA) */}
            <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-b from-[#1a102e] to-[#120b22] border border-[#3e2468] shadow-lg text-left flex-shrink-0">
              {user ? (
                <div>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#7c3aed] bg-[#1e1333] flex-shrink-0 shadow-sm">
                      {user.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#c084fc]">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#120b22]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{user.name}</div>
                      <div className="text-[10px] text-[#9b89b4] truncate">{user.email || "aluno@bsi.edu.br"}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Google Conectado
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined" && window.innerWidth < 768) {
                        setSidebarOpen(false);
                      }
                      setIsProfileOpen(true);
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#201438] hover:bg-[#2a1a48] text-[#c084fc] hover:text-white font-bold text-[11px] transition text-center border border-[#3b2460] cursor-pointer"
                  >
                    Gerenciar Perfil / Desconectar
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.37 24 12 24z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-white">Conta Google</span>
                  </div>
                  <p className="text-[11px] text-[#baa9d0] mb-2.5 leading-relaxed">
                    Conecte para sincronizar suas dúvidas e salvar seu histórico na nuvem.
                  </p>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined" && window.innerWidth < 768) {
                        setSidebarOpen(false);
                      }
                      setIsProfileOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                  >
                    <span>Entrar com o Google</span>
                    <span className="text-xs">→</span>
                  </button>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: BOTÃO NOVA CONVERSA */}
            <button
              onClick={handleNewChat}
              className="w-full py-2.5 px-4 mb-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] text-white text-xs font-bold flex items-center justify-between transition shadow-md shadow-[#7c3aed]/25 cursor-pointer active:scale-95 flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <span>✦</span>
                <span>Nova Conversa</span>
              </div>
              <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-md font-mono">
                + Novo
              </span>
            </button>

            {/* SEÇÃO 3: CABEÇALHO DO HISTÓRICO COM LIMPAR TUDO */}
            <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#796792]">
                  Histórico de Conversas
                </span>
                <span className="text-[10px] text-[#a78bfa] font-bold bg-[#1e1333] px-1.5 py-0.2 rounded-full border border-[#311f4d]">
                  {conversations.length}
                </span>
              </div>

              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModalId("all");
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  title="Apagar todo o histórico"
                >
                  <span>Limpar tudo</span>
                </button>
              )}
            </div>

            {/* SEÇÃO 4: LISTA DE CONVERSAS COM BOTÃO DE EXCLUIR FIXO */}
            <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1 py-1">
              {conversations.length === 0 ? (
                <div className="text-xs text-[#796792] italic p-3 text-center">
                  Nenhuma conversa salva ainda.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === activeId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`group relative flex items-center justify-between text-left text-xs font-medium p-2.5 rounded-xl transition cursor-pointer ${
                        isActive
                          ? "bg-[#221538] text-white border-l-2 border-[#8b5cf6] shadow-sm"
                          : "text-[#baa9d0] hover:bg-[#170f24] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 pr-1">
                        <svg className="w-3.5 h-3.5 text-[#a78bfa] opacity-80 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="truncate">{conv.title}</span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 transition flex items-center justify-center flex-shrink-0 cursor-pointer ml-1"
                        title="Apagar esta conversa"
                        aria-label="Apagar conversa"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL COM AMBIENTE ROXO ESCURO ───────────── */}
      <main className="flex-1 flex flex-col h-full min-h-0 bg-[#0c0816] bg-[radial-gradient(ellipse_75%_55%_at_50%_15%,#261545_0%,#0c0816_70%)] relative overflow-hidden">
        {/* ── BOTÃO FIXO NO CANTO SUPERIOR ESQUERDO (SEMPRE VISÍVEL) ── */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#160d26]/95 hover:bg-[#201438] active:scale-95 border border-[#3e2366] hover:border-[#7c3aed] text-white shadow-xl shadow-black/70 backdrop-blur-md transition-all cursor-pointer group"
          title="Abrir Histórico e Conta Google"
          aria-label="Abrir Menu de Histórico e Conta Google"
        >
          <div className="w-5 h-5 rounded-lg bg-[#271542] group-hover:bg-[#7c3aed] text-[#c084fc] group-hover:text-white flex items-center justify-center transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span className="text-xs font-bold text-white tracking-wide">
            Histórico & Conta
          </span>
          {user ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
          )}
        </button>

        {/* ── BOTÃO FIXO NO CANTO SUPERIOR DIREITO (+ NOVA CONVERSA) ── */}
        <button
          onClick={handleNewChat}
          className="fixed top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-95 text-white text-xs font-bold shadow-xl shadow-[#7c3aed]/30 transition cursor-pointer"
          title="Nova conversa"
        >
          <span>+ Nova</span>
        </button>

        {/* ── CONTEÚDO PRINCIPAL (COM PADDING SUPERIOR PARA OS BOTÕES FIXOS) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 sm:px-8 md:px-12 pt-16 pb-3 flex flex-col">
          {!hasMessages ? (
            /* ── TELA INICIAL CENTRALIZADA (ESTILO ZYRICON / DARK PURPLE) ── */
            <div className="flex-1 flex flex-col items-center justify-center max-w-3xl w-full mx-auto px-1 sm:px-2 animate-fade-in my-auto pb-4 sm:pb-6 pt-2 sm:pt-4">
              {/* Esfera 3D Roxo Brilhante (Glowing Orb) */}
              <div className="glowing-orb mb-4 sm:mb-5 shadow-2xl" />

              {/* Título de Boas-Vindas */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight text-center mb-4 sm:mb-6 leading-tight">
                Olá {user ? firstName : "aluno"},{" "}
                <span className="bg-gradient-to-r from-[#c084fc] via-[#e879f9] to-[#c084fc] bg-clip-text text-transparent">
                  como posso te ajudar hoje?
                </span>
              </h1>

              {/* Pílulas de Sugestão acima da caixa de prompt */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                {TOP_PILLS.map((pill, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(pill.prompt)}
                    className="flex items-center px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#160e22] hover:bg-[#25183a] border border-[#2c1d42] hover:border-[#7c3aed] text-[11px] sm:text-xs font-medium text-[#d8cce8] hover:text-white transition shadow-sm cursor-pointer"
                  >
                    <span>{pill.label}</span>
                  </button>
                ))}
              </div>

              {/* Card Central de Prompt Escuro Moderno */}
              <div className="w-full bg-[#150e22] border border-[#2e1d44] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/25 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl transition-all">
                {selectedImage && (
                  <div className="mb-3 flex items-center gap-3 p-2 bg-[#1c122e] rounded-2xl border border-[#3b255a] w-fit max-w-full animate-fade-in">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage}
                      alt="Prévia"
                      className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl border border-[#4c2882]"
                    />
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[200px]">
                        {imageName || "Imagem selecionada"}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Imagem pronta para análise
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="w-7 h-7 rounded-full bg-[#26173d] hover:bg-rose-950 text-slate-400 hover:text-rose-200 flex items-center justify-center transition cursor-pointer"
                      title="Remover imagem"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <span className="text-[#a855f7] text-base mt-2 select-none">✦</span>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder={
                      selectedImage
                        ? "Adicione uma dúvida sobre esta imagem..."
                        : "Pergunte qualquer coisa sobre Sistemas de Informação ou envie foto no '+'..."
                    }
                    rows={2}
                    className="w-full bg-transparent text-white font-medium text-sm sm:text-base placeholder:text-[#6f5e88] resize-none focus:outline-none pt-1 min-h-[50px] sm:min-h-[55px] max-h-40 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#231536] mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#1f1433] hover:bg-[#2b1a46] border border-[#372456] text-[#c4b5fd] hover:text-white text-xs font-semibold transition cursor-pointer shadow-xs active:scale-95"
                      title="Enviar imagem de exercício ou diagrama"
                    >
                      <svg className="w-3.5 h-3.5 text-[#c4b5fd]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>Anexar Imagem</span>
                    </button>

                    <span className="hidden sm:inline-block text-[10px] font-bold text-[#8f7aa8] uppercase tracking-wider bg-[#1a1128] px-2.5 py-1 rounded-md border border-[#2b1c40]">
                      PET-BSI
                    </span>
                  </div>

                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!canSend}
                    aria-label="Enviar mensagem"
                    className="w-9 h-9 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#7c3aed]/40 active:scale-95 flex-shrink-0"
                  >
                    {isLoading ? (
                      <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* 3 Feature Cards no Rodapé (Exatamente como a imagem de referência) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5 mt-4 sm:mt-6 w-full">
                {FEATURE_CARDS.map((card, idx) => (
                  <div
                    key={idx}
                    onClick={() => sendMessage(card.prompt)}
                    className="bg-[#130d1f] hover:bg-[#1a112a] border border-[#26173a] hover:border-[#633996] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition group cursor-pointer shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                        {card.iconType === "math" && (
                          <svg className="w-5 h-5 text-[#c084fc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10H9m-3-5h12M4 4h16v16H4V4z" />
                          </svg>
                        )}
                        {card.iconType === "db" && (
                          <svg className="w-5 h-5 text-[#c084fc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m-16 5c0 2.21 3.582 4 8 4s8-1.79 8-4m-16 5c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
                          </svg>
                        )}
                        {card.iconType === "code" && (
                          <svg className="w-5 h-5 text-[#c084fc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-[#c084fc] bg-[#22133a] group-hover:bg-[#7c3aed] group-hover:text-white px-2 py-0.5 rounded-full transition">
                        {card.badge}
                      </span>
                    </div>
                    <div className="font-bold text-white text-xs mb-1 group-hover:text-[#c084fc] transition-colors">
                      {card.title}
                    </div>
                    <p className="text-[11px] text-[#8e7da6] leading-relaxed line-clamp-2">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── HISTÓRICO DE MENSAGENS NA CONVERSA SELECIONADA ── */
            <div className="max-w-4xl w-full mx-auto space-y-3.5 sm:space-y-4 py-2 sm:py-4 flex-1">
              {currentMessages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}

              {isLoading && (
                <div className="flex items-start gap-2.5 sm:gap-3 mb-4 sm:mb-5 animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#23143d] border border-[#4c2882] text-[#c084fc] flex items-center justify-center font-black text-[11px] sm:text-xs select-none mt-0.5 shadow-md">
                    PET
                  </div>
                  <TypingIndicator coldStart={coldStartTentativa > 0} tentativa={coldStartTentativa} />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── BARRA INFERIOR DE INPUT FIXADA (QUANDO EM CONVERSA) ── */}
        {hasMessages && (
          <footer className="flex-shrink-0 p-2 sm:p-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] bg-[#0c0816]/95 backdrop-blur-md border-t border-[#1d132a] z-20">
            <div className="max-w-4xl mx-auto w-full">
              {selectedImage && (
                <div className="mb-2 flex items-center gap-3 p-1.5 sm:p-2 bg-[#1c122e] rounded-xl sm:rounded-2xl border border-[#3b255a] w-fit max-w-full animate-fade-in">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedImage}
                    alt="Prévia"
                    className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg sm:rounded-xl border border-[#4c2882]"
                  />
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[200px]">
                      {imageName || "Imagem selecionada"}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Imagem pronta
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="w-6 h-6 rounded-full bg-[#26173d] hover:bg-rose-950 text-slate-400 hover:text-rose-200 flex items-center justify-center transition cursor-pointer"
                    title="Remover imagem"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="relative flex items-end rounded-xl sm:rounded-2xl bg-[#150e22] border border-[#2e1d44] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/20 p-1.5 sm:p-2 pl-2.5 sm:pl-3.5 pr-1.5 sm:pr-2.5 shadow-xl transition-all">
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="w-8 h-8 rounded-full bg-[#1f1433] hover:bg-[#2b1a46] border border-[#372456] text-[#c4b5fd] flex items-center justify-center transition cursor-pointer mr-2 sm:mr-2.5 flex-shrink-0 mb-0.5"
                  title="Enviar imagem de exercício"
                >
                  <svg className="w-4 h-4 text-[#c4b5fd]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <textarea
                  ref={footerTextareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                  placeholder={
                    selectedImage
                      ? "Dúvida sobre a imagem..."
                      : "Pergunte algo ou envie foto no clipe..."
                  }
                  className="w-full bg-transparent text-white font-medium text-sm sm:text-base placeholder:text-[#6f5e88] focus:outline-none pr-2 sm:pr-3 resize-none py-1.5 min-h-[36px] max-h-40 leading-relaxed overflow-y-auto"
                />

                <button
                  onClick={() => sendMessage(input)}
                  disabled={!canSend}
                  aria-label="Enviar"
                  className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-[#7c3aed]/40 active:scale-95 mb-0.5"
                >
                  {isLoading ? (
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="hidden sm:flex items-center justify-center mt-2 text-[10px] font-medium text-[#7d6c96]">
                Pressione Enter para enviar • PET-BSI Sistemas de Informação
              </div>
            </div>
          </footer>
        )}
      </main>

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (TEMA ESCURO) ── */}
      {deleteModalId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setDeleteModalId(null)}
        >
          <div 
            className="relative w-full max-w-xs bg-[#140d22] rounded-3xl p-6 shadow-2xl border border-[#2f1f48] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ícone */}
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center shadow-xs text-rose-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <h3 className="text-base font-black text-white tracking-tight mb-1">
              {deleteModalId === "all" ? "Limpar todo o histórico?" : "Apagar esta conversa?"}
            </h3>
            <p className="text-xs text-[#a594be] leading-relaxed mb-5">
              {deleteModalId === "all"
                ? "Todas as suas conversas serão excluídas definitivamente da sua conta e deste celular."
                : "Essa conversa será removida definitivamente do seu histórico e da nuvem."}
            </p>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteModalId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#352350] hover:bg-[#1f1433] text-[#baa9d0] font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md cursor-pointer active:scale-95"
              >
                Sim, apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST DE AVISO (TEMA ESCURO) ── */}
      {imageErrorToast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 bg-[#1e1333] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-center sm:justify-start gap-2 text-xs font-bold animate-fade-in border border-[#4c2882]">
          <svg className="w-4 h-4 text-[#c084fc] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{imageErrorToast}</span>
        </div>
      )}
    </div>
  );
}
