import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
type Theme = "light" | "dark" | "system";
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

// 根据本地时间判断是否应该使用深色模式
// 白天 6:00 - 18:00 使用浅色，其余时间使用深色
function isDarkByTime(): boolean {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 18;
}

// 计算距离下一个切换时间点的毫秒数
function msUntilNextSwitch(): number {
  const now = new Date();
  const hour = now.getHours();
  const next = new Date(now);
  
  if (hour < 6) {
    // 当前是凌晨深色，下一个切换点是 6:00（切到浅色）
    next.setHours(6, 0, 0, 0);
  } else if (hour < 18) {
    // 当前是白天浅色，下一个切换点是 18:00（切到深色）
    next.setHours(18, 0, 0, 0);
  } else {
    // 当前是晚上深色，下一个切换点是明天 6:00（切到浅色）
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  
  return next.getTime() - now.getTime();
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });
  
  // 用于强制重新计算 system 主题的触发器
  const [systemTick, setSystemTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (switchable) {
      localStorage.setItem("theme", newTheme);
    }
  };

  // 应用主题到 DOM 的函数
  const applyTheme = useCallback((currentTheme: Theme) => {
    const root = document.documentElement;
    let effectiveTheme = currentTheme;
    
    // 处理 system 主题：优先检测操作系统偏好，同时结合本地时间
    if (currentTheme === "system") {
      // 方案：结合操作系统偏好和本地时间
      // 1. 如果操作系统有明确的深色模式偏好，跟随操作系统
      // 2. 同时也根据本地时间自动切换（6:00-18:00 浅色，其余深色）
      // 两者取"或"关系：任一条件触发深色则使用深色
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const timeDark = isDarkByTime();
      effectiveTheme = (prefersDark || timeDark) ? "dark" : "light";
    }
    
    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  // 当 theme 或 systemTick 改变时应用主题
  useEffect(() => {
    applyTheme(theme);
  }, [theme, systemTick, applyTheme]);

  // 监听系统主题偏好变化
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      applyTheme("system");
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme, applyTheme]);

  // 基于本地时间的定时切换
  useEffect(() => {
    if (theme !== "system") {
      // 清除定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 设置定时器，在下一个切换时间点触发
    const scheduleNext = () => {
      const ms = msUntilNextSwitch();
      timerRef.current = setTimeout(() => {
        // 触发重新计算
        setSystemTick(prev => prev + 1);
        // 递归设置下一个定时器
        scheduleNext();
      }, ms);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [theme]);

  // 页面可见性变化时重新检测（用户切换回页面时）
  useEffect(() => {
    if (theme !== "system") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        applyTheme("system");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [theme, applyTheme]);

  const toggleTheme = switchable
    ? () => {
        setTheme(theme === "light" ? "dark" : "light");
      }
    : undefined;
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
