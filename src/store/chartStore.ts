import { create } from 'zustand';

interface ChartState {
  symbol: string;
  interval: string;
  trackedSymbols: string[];
  isRsiVisible: boolean;
  isMacdVisible: boolean;
  
  liquidationSettings: {
    soundEnabled: boolean;
    maxItems: number;
    thresholds: Record<string, number>;
    exchanges: {
      binance: boolean;
      bybit: boolean;
      okx: boolean;
    };
  };

  // ✅ НОВОЕ: настройки для ордеров китов
  whaleOrderSettings: {
    enabled: boolean;
    threshold: number; // минимальный размер ордера в USDT
    maxItems: number;
    showOnChart: boolean;
  };
  
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  toggleTrackedSymbol: (symbol: string) => void;
  toggleRsi: () => void;
  toggleMacd: () => void;
  setLiquidationSettings: (settings: Partial<ChartState['liquidationSettings']>) => void;
  setLiquidationThreshold: (symbol: string, threshold: number) => void;
  setWhaleOrderSettings: (settings: Partial<ChartState['whaleOrderSettings']>) => void;
  loadState: () => void;
}

export const useChartStore = create<ChartState>((set) => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  trackedSymbols: ['BTCUSDT'],
  isRsiVisible: false,
  isMacdVisible: false,
  
  liquidationSettings: {
    soundEnabled: true,
    maxItems: 15,
    thresholds: {
      'BTCUSDT': 50000,
      'ETHUSDT': 20000,
      'SOLUSDT': 10000,
    },
    exchanges: {
      binance: true,
      bybit: true,
      okx: true,
    },
  },

  // ✅ НОВОЕ: настройки по умолчанию
  whaleOrderSettings: {
    enabled: true,
    threshold: 500000, // 500K USDT — порог для "кита"
    maxItems: 20,
    showOnChart: true,
  },
  
  setSymbol: (symbol) => set({ symbol }),
  setInterval: (interval) => set({ interval }),
  toggleTrackedSymbol: (symbol) => set((state) => ({
    trackedSymbols: state.trackedSymbols.includes(symbol)
      ? state.trackedSymbols.filter((s) => s !== symbol)
      : [...state.trackedSymbols, symbol]
  })),
  toggleRsi: () => set((state) => ({ isRsiVisible: !state.isRsiVisible })),
  toggleMacd: () => set((state) => ({ isMacdVisible: !state.isMacdVisible })),
  
  setLiquidationSettings: (settings) => set((state) => ({
    liquidationSettings: { ...state.liquidationSettings, ...settings }
  })),
  
  setLiquidationThreshold: (symbol, threshold) => set((state) => ({
    liquidationSettings: {
      ...state.liquidationSettings,
      thresholds: { ...state.liquidationSettings.thresholds, [symbol]: threshold }
    }
  })),

  // ✅ НОВОЕ: сеттер для китов
  setWhaleOrderSettings: (settings) => set((state) => ({
    whaleOrderSettings: { ...state.whaleOrderSettings, ...settings }
  })),
  
  loadState: () => {
    const savedSymbol = localStorage.getItem('chartSymbol');
    const savedInterval = localStorage.getItem('chartInterval');
    if (savedSymbol) set({ symbol: savedSymbol });
    if (savedInterval) set({ interval: savedInterval });
  },
}));