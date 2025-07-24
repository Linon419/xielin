// Vercel Serverless Function - 市场数据API
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
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: '缺少symbol参数'
      });
    }

    // 模拟市场数据
    const mockData = {
      symbol: symbol.toUpperCase(),
      price: Math.random() * 50000 + 30000, // 30000-80000之间的随机价格
      change24h: (Math.random() - 0.5) * 10, // -5% 到 +5%
      volume24h: Math.random() * 1000000000, // 随机成交量
      high24h: Math.random() * 55000 + 35000,
      low24h: Math.random() * 45000 + 25000,
      openInterest: Math.random() * 500000000,
      fundingRate: (Math.random() - 0.5) * 0.001,
      lastUpdated: new Date().toISOString(),
      contractType: 'perpetual',
      exchange: 'Binance'
    };

    res.status(200).json({
      success: true,
      data: mockData
    });

  } catch (error) {
    console.error('Market data API error:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}
