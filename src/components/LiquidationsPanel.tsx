import { useState } from 'react';
import { useChartStore } from '../store/chartStore';
import { useLiquidations } from '../hooks/useLiquidations';

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}ч`;
  if (minutes > 0) return `${minutes}м`;
  return `${seconds}с`;
}

export function LiquidationsPanel() {
  const { trackedSymbols, liquidationSettings, setLiquidationSettings, setLiquidationThreshold } = useChartStore();
  const { liquidations, isConnected } = useLiquidations();
  const [showSettings, setShowSettings] = useState(false);
  
  const [localThresholds, setLocalThresholds] = useState<Record<string, string>>({});
  const [localMaxItems, setLocalMaxItems] = useState<string>('');

  const handleShowSettings = () => {
    const newLocal: Record<string, string> = {};
    trackedSymbols.forEach(symbol => {
      newLocal[symbol] = String(liquidationSettings.thresholds[symbol] ?? 800000);
    });
    setLocalThresholds(newLocal);
    setLocalMaxItems(String(liquidationSettings.maxItems));
    setShowSettings(true);
  };

  const handleThresholdBlur = (symbol: string) => {
    const value = Number(localThresholds[symbol]);
    if (!isNaN(value) && value >= 0) {
      setLiquidationThreshold(symbol, value);
    }
  };

  const handleThresholdKeyDown = (e: React.KeyboardEvent, symbol: string) => {
    if (e.key === 'Enter') {
      handleThresholdBlur(symbol);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleMaxItemsBlur = () => {
    const value = Number(localMaxItems);
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setLiquidationSettings({ maxItems: value });
    } else {
      setLocalMaxItems(String(liquidationSettings.maxItems));
    }
  };

  const handleMaxItemsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleMaxItemsBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Заголовок */}
      <div className="flex-shrink-0 py-1 px-2 text-[10px] font-bold text-gray-400 uppercase bg-[#1e222d] border-b border-[#2a2e39] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span>Ликвидации</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </div>
        <button 
          onClick={() => showSettings ? setShowSettings(false) : handleShowSettings()}
          className="text-gray-500 hover:text-white transition-colors"
        >
          ⚙️
        </button>
      </div>

      {/* Настройки */}
      {showSettings && (
        <div className="flex-shrink-0 bg-[#1e222d] border-b border-[#2a2e39] p-2 text-xs space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <span>Звук:</span>
            <input
              type="checkbox"
              checked={liquidationSettings.soundEnabled}
              onChange={(e) => setLiquidationSettings({ soundEnabled: e.target.checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-300">Макс. записей:</span>
            <input
              type="number"
              value={localMaxItems}
              onChange={(e) => setLocalMaxItems(e.target.value)}
              onBlur={handleMaxItemsBlur}
              onKeyDown={handleMaxItemsKeyDown}
              className="threshold-input w-16 px-2 py-1 bg-[#0a0e17] border border-[#2a2e39] rounded text-left text-[11px] text-white outline-none focus:border-blue-500"
              min="1"
              max="100"
              placeholder="15"
            />
          </div>
          
          <div className="text-[10px] text-gray-500">Пороги ликвидаций (USDT):</div>
          {trackedSymbols.map(symbol => (
            <div key={symbol} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-300 whitespace-nowrap">{symbol}:</span>
              <input
                type="number"
                value={localThresholds[symbol] ?? ''}
                onChange={(e) => setLocalThresholds(prev => ({ ...prev, [symbol]: e.target.value }))}
                onBlur={() => handleThresholdBlur(symbol)}
                onKeyDown={(e) => handleThresholdKeyDown(e, symbol)}
                className="threshold-input w-24 px-2 py-1 bg-[#0a0e17] border border-[#2a2e39] rounded text-left text-[11px] text-white outline-none focus:border-blue-500"
                min="0"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}

      {/* Список ликвидаций — занимает всё оставшееся место */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {liquidations.length === 0 ? (
          <div className="text-gray-600 text-xs text-center mt-4">
            {trackedSymbols.length === 0 ? 'Выберите монеты' : 'Нет данных'}
          </div>
        ) : (
          liquidations.map((liq) => (
            <div
              key={liq.id}
              className="px-2 py-1 border-b border-[#2a2e39] hover:bg-[#1e222d] transition-colors"
              style={{ animation: 'slideIn 0.3s ease-out' }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-yellow-500 font-bold">Binance</span>
                  <span className="text-[10px] text-gray-400">{liq.symbol}</span>
                </div>
                <span className={`text-[10px] font-bold ${liq.side === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                  {liq.side === 'long' ? 'LONG 🟢' : 'SHORT 🔴'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-300">${liq.price.toLocaleString()}</span>
                <span className="text-white font-bold">{formatValue(liq.value)}</span>
              </div>
              
              <div className="text-[10px] text-gray-500 text-right">
                {formatTime(liq.time)} назад
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); background: rgba(255,255,255,0.1); }
          to { opacity: 1; transform: translateY(0); background: transparent; }
        }
        
        .threshold-input::-webkit-outer-spin-button,
        .threshold-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .threshold-input[type=number] {
          -moz-appearance: textfield;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e222d;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4a4e59;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}