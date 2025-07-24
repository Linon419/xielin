// Vercel Serverless Function - 历史数据API
export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { symbol, timeframe = '1h', limit = 100 } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: '缺少symbol参数'
      });
    }

    // 生成模拟历史数据
    const generateOHLCVData = (count) => {
      const data = [];
      let basePrice = 45000;
      const now = Date.now();
      
      // 根据时间周期计算间隔
      const intervals = {
        '1m': 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000
      };
      
      const interval = intervals[timeframe] || intervals['1h'];

      for (let i = count - 1; i >= 0; i--) {
        const timestamp = now - (i * interval);
        const volatility = 0.02; // 2% 波动率
        
        const open = basePrice + (Math.random() - 0.5) * basePrice * volatility;
        const close = open + (Math.random() - 0.5) * open * volatility;
        const high = Math.max(open, close) + Math.random() * open * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * open * volatility * 0.5;
        const volume = Math.random() * 1000000;

        data.push({
          timestamp,
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: parseFloat(volume.toFixed(2))
        });

        basePrice = close; // 下一个K线的基准价格
      }

      return data;
    };

    const historicalData = generateOHLCVData(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        timeframe,
        data: historicalData
      }
    });

  } catch (error) {
    console.error('Historical data API error:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}
