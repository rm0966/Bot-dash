import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { BotInfo } from "@workspace/api-client-react";

interface BotState {
  token: string | null;
  botInfo: BotInfo | null;
  setBot: (token: string, info: BotInfo) => void;
  logout: () => void;
}

const BotContext = createContext<BotState | undefined>(undefined);

export function BotProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem("discord_bot_token");
  });
  
  const [botInfo, setBotInfo] = useState<BotInfo | null>(() => {
    const saved = localStorage.getItem("discord_bot_info");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const setBot = (newToken: string, info: BotInfo) => {
    setTokenState(newToken);
    setBotInfo(info);
    localStorage.setItem("discord_bot_token", newToken);
    localStorage.setItem("discord_bot_info", JSON.stringify(info));
  };

  const logout = () => {
    setTokenState(null);
    setBotInfo(null);
    localStorage.removeItem("discord_bot_token");
    localStorage.removeItem("discord_bot_info");
  };

  return (
    <BotContext.Provider value={{ token, botInfo, setBot, logout }}>
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const context = useContext(BotContext);
  if (context === undefined) {
    throw new Error("useBot must be used within a BotProvider");
  }
  return context;
}
