import { useEffect, useRef, useState, useCallback } from 'react';
import { useChartStore } from '../store/chartStore';

export interface BybitLiquidation {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  value: number;
  time: number;
}

export function useBybitLiquidations() {
  const { trackedSymbols, liquidationSettings } = useChartStore();
  const [liquidations, setLiquidations] = useState<BybitLiquidation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const settingsRef = useRef(liquidationSettings);
  const trackedRef = useRef(trackedSymbols);

  useEffect(() => {
    settingsRef.current = liquidationSettings;
  });

  useEffect(() => {
    trackedRef.current = trackedSymbols;
  });

  const addLiquidation = useCallback((liq: BybitLiquidation) => {
    const currentSettings = settingsRef.current;
    
    console.log('💥 Bybit ликвидация:', liq.symbol, liq.side.toUpperCase(), `$${liq.value.toLocaleString()}`);
    
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

    const connect = () => {
      console.log('🔌 Bybit WebSocket...');
      
      const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Bybit подключен');
        const symbols = trackedRef.current.map(s => `liquidation.${s}`);
        ws.send(JSON.stringify({ op: 'subscribe', args: symbols }));
        setIsConnected(true);
        
        // Keepalive - отправляем ping каждые 20 секунд
        keepaliveIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 'ping' }));
            console.log('🏓 Bybit ping отправлен');
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Ответ на ping от сервера
          if (data.op === 'pong') {
            console.log('🏓 Bybit pong получен');
            return;
          }
          
          // Игнорируем успешную подписку
          if (data.op === 'subscribe' && data.success) {
            console.log('✅ Подписка подтверждена:', data.req_id);
            return;
          }
          
          if (data.topic && data.topic.startsWith('liquidation.') && data.data) {
            const symbol = data.topic.split('.')[1];
            const order = data.data;
            
            const currentTracked = trackedRef.current;
            if (!currentTracked.includes(symbol)) return;
            
            const currentSettings = settingsRef.current;
            const threshold = currentSettings.thresholds[symbol] || 800000;
            
            const price = parseFloat(order.price);
            const quantity = parseFloat(order.size);
            const value = price * quantity;
            
            if (value < threshold) return;

            const side = order.side.toLowerCase() === 'sell' ? 'long' : 'short';
            const id = `bybit-${order.updateTime}-${symbol}`;
            
            if (!seenIdsRef.current.has(id)) {
              seenIdsRef.current.add(id);
              addLiquidation({
                id,
                symbol,
                side,
                price,
                quantity,
                value,
                time: parseInt(order.updateTime),
              });
            }
          }
        } catch (err) {
          // Игнорируем ошибки парсинга
        }
      };

      ws.onclose = () => {
        console.log('❌ Bybit отключен');
        setIsConnected(false);
        if (keepaliveIntervalRef.current) {
          clearInterval(keepaliveIntervalRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 10000); // Увеличили до 10 сек
      };

      ws.onerror = (error) => {
        console.error('❌ Bybit error:', error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [trackedSymbols, addLiquidation]);

  return { liquidations, isConnected };
}