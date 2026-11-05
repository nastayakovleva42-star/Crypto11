import { useEffect, useRef, useState, useCallback } from 'react';
import { useChartStore } from '../store/chartStore';

export interface OkxLiquidation {
  id: string;
  symbol: string;
  exchange: 'OKX';
  side: 'long' | 'short';
  price: number;
  quantity: number;
  value: number;
  time: number;
}

export function useOkxLiquidations() {
  const { trackedSymbols, liquidationSettings } = useChartStore();
  const [liquidations, setLiquidations] = useState<OkxLiquidation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const settingsRef = useRef(liquidationSettings);
  const trackedRef = useRef(trackedSymbols);

  useEffect(() => {
    settingsRef.current = liquidationSettings;
  });

  useEffect(() => {
    trackedRef.current = trackedSymbols;
  });

  const addLiquidation = useCallback((liq: OkxLiquidation) => {
    const currentSettings = settingsRef.current;
    
    setLiquidations(prev => {
      const exists = prev.some(l => l.id === liq.id);
      if (exists) return prev;
      
      const newLiqs = [liq, ...prev];
      return newLiqs.slice(0, currentSettings.maxItems);
    });
  }, []);

  useEffect(() => {
    if (trackedSymbols.length === 0) {
      setIsConnected(false);
      return;
    }

    const fetchOkx = async () => {
      try {
        const ulyList = [...new Set(trackedRef.current.map(s => s.replace('USDT', '-USDT')))];
        const now = Date.now();
        
        for (const uly of ulyList) {
          const response = await fetch(
            `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=${uly}&state=filled`
          );
          
          if (!response.ok) continue;
          
          const json = await response.json();
          
          if (json.code !== '0' || !json.data || json.data.length === 0) {
            continue;
          }
          
          const details = json.data[0].details || [];
          const symbol = uly.replace('-USDT', 'USDT');
          const currentSettings = settingsRef.current;
          const threshold = currentSettings.thresholds[symbol] || 800000;

          details.forEach((item: any) => {
            const itemTime = parseInt(item.ts);
            const ageInSeconds = (now - itemTime) / 1000;
            
            // Игнорируем ликвидации старше 2 минут
            if (ageInSeconds > 120) return;
            
            const price = parseFloat(item.bkPx);
            const quantity = parseFloat(item.sz);
            const value = price * quantity;
            
            if (value < threshold) return;

            const side = item.posSide === 'long' ? 'long' : 'short';
            const id = `okx-${item.ts}-${symbol}`;
            
            if (!seenIdsRef.current.has(id)) {
              seenIdsRef.current.add(id);
              addLiquidation({
                id,
                symbol,
                exchange: 'OKX',                side,
                price,
                quantity,
                value,
                time: itemTime,
              });
            }
          });
        }
        
        setIsConnected(true);
      } catch (err) {
        console.error('OKX fetch error:', err);
        setIsConnected(false);
      }
    };

    fetchOkx();
    pollIntervalRef.current = setInterval(fetchOkx, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [trackedSymbols, addLiquidation]);

  return { liquidations, isConnected };
}