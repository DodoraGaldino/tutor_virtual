/**
 * page.tsx
 * Página principal — apenas renderiza o componente Chat.
 */

import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="flex h-screen flex-col">
      <Chat />
    </main>
  );
}
