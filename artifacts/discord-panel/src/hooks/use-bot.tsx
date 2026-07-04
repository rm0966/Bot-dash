import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { BotInfo } from "@workspace/api-client-react";

export interface SavedToken {
  id: string;
  name: string;
  token: string;
  botInfo: BotInfo;
  savedAt: number;
}

interface BotState {
  token: string | null;
  botInfo: BotInfo | null;
  savedTokens: SavedToken[];
  setBot: (token: string, info: BotInfo) => void;
  saveCurrentToken: (name: string) => void;
  deleteToken: (id: string) => void;
  switchToken: (saved: SavedToken) => void;
  logout: () => void;
}

const BotContext = createContext<BotState | undefined>(undefined);

function loadSavedTokens(): SavedToken[] {
  try {
    const raw = localStorage.getItem("discord_saved_tokens");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSavedTokens(tokens: SavedToken[]) {
  localStorage.setItem("discord_saved_tokens", JSON.stringify(tokens));
}

export function BotProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem("discord_bot_token")
  );

  const [botInfo, setBotInfo] = useState<BotInfo | null>(() => {
    try {
      const raw = localStorage.getItem("discord_bot_info");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [savedTokens, setSavedTokens] = useState<SavedToken[]>(() => loadSavedTokens());

  const setBot = (newToken: string, info: BotInfo) => {
    setTokenState(newToken);
    setBotInfo(info);
    localStorage.setItem("discord_bot_token", newToken);
    localStorage.setItem("discord_bot_info", JSON.stringify(info));
  };

  const saveCurrentToken = (name: string) => {
    if (!token || !botInfo) return;
    setSavedTokens((prev) => {
      const exists = prev.find((t) => t.token === token);
      let updated: SavedToken[];
      if (exists) {
        updated = prev.map((t) =>
          t.token === token ? { ...t, name, botInfo: botInfo!, savedAt: Date.now() } : t
        );
      } else {
        const newEntry: SavedToken = {
          id: crypto.randomUUID(),
          name,
          token,
          botInfo: botInfo!,
          savedAt: Date.now(),
        };
        updated = [newEntry, ...prev];
      }
      saveSavedTokens(updated);
      return updated;
    });
  };

  const deleteToken = (id: string) => {
    setSavedTokens((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveSavedTokens(updated);
      return updated;
    });
  };

  const switchToken = (saved: SavedToken) => {
    setTokenState(saved.token);
    setBotInfo(saved.botInfo);
    localStorage.setItem("discord_bot_token", saved.token);
    localStorage.setItem("discord_bot_info", JSON.stringify(saved.botInfo));
  };

  const logout = () => {
    setTokenState(null);
    setBotInfo(null);
    localStorage.removeItem("discord_bot_token");
    localStorage.removeItem("discord_bot_info");
  };

  return (
    <BotContext.Provider value={{ token, botInfo, savedTokens, setBot, saveCurrentToken, deleteToken, switchToken, logout }}>
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const context = useContext(BotContext);
  if (context === undefined) throw new Error("useBot must be used within a BotProvider");
  return context;
}
