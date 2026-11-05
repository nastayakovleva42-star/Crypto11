import { useEffect, useRef, useState, useCallback } from 'react';
import { useChartStore } from '../store/chartStore';

export interface Liquidation {
  id: string;
  symbol: string;
  exchange: 'Binance';
  side: 'long' | 'short';
  price: number;
  quantity: number;
  value: number;
  time: number;
}

function normalizeSide(rawSide: string): 'long' | 'short' {
  return rawSide === 'SELL' ? 'short' : 'long';
}

export function useLiquidations() {
  const { trackedSymbols, liquidationSettings } = useChartStore();
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const settingsRef = useRef(liquidationSettings);
  const trackedRef = useRef(trackedSymbols);

  useEffect(() => {
    settingsRef.current = liquidationSettings;
  });

  useEffect(() => {
    trackedRef.current = trackedSymbols;
  });

  // Инициализация звука при первом клике
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('✅ Звук активирован');
        } catch (err) {
          console.error('AudioContext error:', err);
        }
      }
    };
    
    document.addEventListener('click', initAudio, { once: true });
    return () => document.removeEventListener('click', initAudio);
  }, []);

  const playSound = useCallback((side: 'long' | 'short') => {
    if (!audioContextRef.current) {
      console.warn('⚠️ Кликни на страницу для активации звука');
      return;
    }

    try {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.frequency.value = side === 'long' ? 800 : 600;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContextRef.current.currentTime + 0.15);
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  }, []);

  const addLiquidation = useCallback((liq: Liquidation) => {
    const currentSettings = settingsRef.current;
    
    setLiquidations(prev => {
      const exists = prev.some(l => l.id === liq.id);
      if (exists) return prev;
      
      const newLiqs = [liq, ...prev];
      return newLiqs.slice(0, currentSettings.maxItems);
    });

    if (currentSettings.soundEnabled) {
      const now = Date.now();
      if (now - lastSoundTimeRef.current > 1000) {
        playSound(liq.side);
        lastSoundTimeRef.current = now;
      }
    }
  }, [playSound]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (trackedSymbols.length === 0) {
      setIsConnected(false);
      return;
    }

    const connect = () => {
      console.log('🔌 Подключение к Binance...');
      
      const ws = new WebSocket('wss://fstream.binance.com/market/ws/!forceOrder@arr');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Binance Liquidations WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const items = Array.isArray(data) ? data : [data];
          
          const currentTracked = trackedRef.current;
          const currentSettings = settingsRef.current;
          
          items.forEach((item: any) => {
            if (!item.o) return;
            const order = item.o;
            const symbol = order.s;
            
            if (!currentTracked.includes(symbol)) return;
            
            const threshold = currentSettings.thresholds[symbol] || 800000;
            const price = parseFloat(order.p);
            const quantity = parseFloat(order.q);
            const value = price * quantity;
            
            if (value < threshold) return;
            
            addLiquidation({
              id: `binance-${order.T}-${symbol}`,
              symbol,
              exchange: 'Binance',
              side: normalizeSide(order.S),
              price,
              quantity,
              value,
              time: order.T,
            });
          });
        } catch (err) {
          console.error('Binance parse error:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('❌ Binance WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setIsConnected(false);
        
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [trackedSymbols, addLiquidation]);

  return {
    liquidations,
    isConnected,
  };
}