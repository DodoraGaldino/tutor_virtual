"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "100458584388-7qt7so3ndm779ho3aeoc4r87eh9dfgin.apps.googleusercontent.com";

export default function ProfileModal() {
  const {
    user,
    logout,
    loginWithGoogleData,
    loginAsStudent,
    isProfileOpen,
    setIsProfileOpen,
  } = useAuth();

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulário de Identificação alternativa de Aluno
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  if (!isProfileOpen) return null;

  /**
   * Dispara o fluxo oficial do Google OAuth 2.0 (Google Identity Services)
   * Abre a janela oficial da Google com a lista de contas @gmail ou institucionais.
   */
  const handleGoogleLoginReal = () => {
    setErrorMsg(null);

    const google = (window as unknown as {
      google?: {
        accounts?: {
          oauth2: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (response: { access_token?: string; error?: string }) => void;
            }) => { requestAccessToken: () => void };
          };
        };
      };
    }).google;

    if (!google?.accounts?.oauth2) {
      setErrorMsg(
        "Carregando serviços do Google... Aguarde 2 segundos e clique novamente."
      );
      return;
    }

    try {
      setLoadingGoogle(true);

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        callback: async (response) => {
          if (response.error) {
            setLoadingGoogle(false);
            if (response.error !== "popup_closed_by_user") {
              setErrorMsg(`Google: ${response.error}`);
            }
            return;
          }

          if (response.access_token) {
            try {
              const userInfoRes = await fetch(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                {
                  headers: {
                    Authorization: `Bearer ${response.access_token}`,
                  },
                }
              );

              if (!userInfoRes.ok) {
                throw new Error("Não foi possível obter dados do perfil Google.");
              }

              const googleData = await userInfoRes.json();

              loginWithGoogleData({
                sub: googleData.sub,
                name: googleData.name || googleData.given_name || "Aluno",
                email: googleData.email,
                picture: googleData.picture,
              });

              setLoadingGoogle(false);
            } catch {
              setLoadingGoogle(false);
              setErrorMsg(
                "Erro ao validar dados com a Google. Verifique sua conexão."
              );
            }
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (err: unknown) {
      setLoadingGoogle(false);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setErrorMsg(`Falha ao iniciar Google Sign-In: ${msg}`);
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setErrorMsg("Por favor, digite seu nome.");
      return;
    }
    loginAsStudent(studentName, studentEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md bg-[#130d22] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#2f1f46] text-[#ede9f6] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={() => setIsProfileOpen(false)}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#1e1333] hover:bg-[#2c1b48] text-[#c4b5fd] hover:text-white flex items-center justify-center transition cursor-pointer"
          title="Fechar"
          aria-label="Fechar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {user ? (
          /* ── PERFIL CONECTADO ── */
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#7c3aed] shadow-lg shadow-[#7c3aed]/20 bg-[#1e1333]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    user.picture ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      user.name
                    )}&backgroundColor=2e1065&textColor=ffffff`
                  }
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#130d22] border border-[#2f1f46] flex items-center justify-center shadow-xs">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
            </div>

            <h2 className="text-xl font-black text-white tracking-tight">
              {user.name}
            </h2>
            <p className="text-xs text-[#a594be] font-medium mb-1">
              {user.email || "aluno@bsi.edu.br"}
            </p>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1 rounded-full mt-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Conta Conectada
            </span>

            <div className="w-full bg-[#170f26] rounded-2xl p-4 border border-[#2a1a3e] text-left mb-6 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[#927fa8] font-medium">Curso:</span>
                <span className="font-bold text-[#c084fc]">
                  Sistemas de Informação
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#927fa8] font-medium">Programa:</span>
                <span className="font-bold text-[#c084fc]">PET-BSI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#927fa8] font-medium">Status:</span>
                <span className="font-bold text-emerald-400">Ativo</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-900/40 text-rose-300 hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer"
            >
              Desconectar Conta
            </button>
          </div>
        ) : (
          /* ── LOGIN COM GOOGLE ── */
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1c1230] border border-[#3b2360] flex items-center justify-center mb-4 text-[#c084fc] shadow-md">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">
              Entrar com Conta Google
            </h2>
            <p className="text-xs text-[#a594be] max-w-xs mb-6 leading-relaxed">
              Conecte sua conta Google ou institucional para salvar seu histórico e personalizar suas dúvidas.
            </p>

            {errorMsg && (
              <div className="w-full mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs text-left leading-relaxed flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* BOTÃO OFICIAL GOOGLE OAUTH */}
            <button
              onClick={handleGoogleLoginReal}
              disabled={loadingGoogle}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-full border border-[#372456] hover:border-[#7c3aed] bg-[#1a1228] hover:bg-[#241738] text-white font-bold text-sm transition shadow-md cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loadingGoogle ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-[#c084fc] rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.37 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>{loadingGoogle ? "Abrindo Google..." : "Entrar com o Google"}</span>
            </button>

            {/* DIVISOR OU */}
            <div className="w-full flex items-center my-4">
              <div className="flex-1 border-t border-[#291b3e]" />
              <span className="px-3 text-[11px] font-bold text-[#8e7aab] uppercase tracking-wider">ou</span>
              <div className="flex-1 border-t border-[#291b3e]" />
            </div>

            {/* FORMULÁRIO RÁPIDO DO ALUNO */}
            <form onSubmit={handleStudentSubmit} className="w-full space-y-2.5 text-left">
              <div>
                <label className="block text-[11px] font-bold text-[#c084fc] mb-1">
                  Seu Nome:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Isadora Silva"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-[#170f24] border border-[#2e1d44] focus:bg-[#1a1128] focus:outline-none focus:border-[#7c3aed] text-white placeholder-[#6f5e88]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#c084fc] mb-1">
                  Seu E-mail (Gmail ou Institucional):
                </label>
                <input
                  type="email"
                  placeholder="Ex: isadora@aluno.ifrn.edu.br"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-[#170f24] border border-[#2e1d44] focus:bg-[#1a1128] focus:outline-none focus:border-[#7c3aed] text-white placeholder-[#6f5e88]"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-xl transition shadow-md shadow-[#7c3aed]/25 cursor-pointer active:scale-98"
              >
                Conectar Perfil de Aluno
              </button>
            </form>

            <p className="text-[10px] text-[#7d6f92] mt-4 leading-normal flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#9e8cb7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>O login conecta diretamente aos servidores oficiais da Google via OAuth 2.0.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
