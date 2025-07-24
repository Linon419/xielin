# 🚀 Vercel部署指南

## 📋 部署前准备

### 1. 项目结构检查
```
crypto-schelling-platform/
├── src/                    # 源代码
├── public/                 # 静态资源
├── package.json           # 依赖配置
├── tsconfig.json          # TypeScript配置
├── vercel.json            # Vercel配置
├── .env                   # 开发环境变量
├── .env.production        # 生产环境变量
└── build/                 # 构建输出（自动生成）
```

### 2. 环境变量配置
在Vercel控制台中需要配置以下环境变量：

| 变量名 | 值 | 说明 |
|--------|----|----|
| `REACT_APP_ENV` | `production` | 环境标识 |
| `REACT_APP_API_BASE_URL` | `https://your-backend-api.vercel.app/api` | 后端API地址 |
| `REACT_APP_APP_NAME` | `加密货币合约谢林点交易策略平台` | 应用名称 |
| `GENERATE_SOURCEMAP` | `false` | 禁用源码映射（可选） |

## 🚀 部署步骤

### 方法一：GitHub集成部署（推荐）

1. **推送代码到GitHub**
   ```bash
   git add .
   git commit -m "准备Vercel部署"
   git push origin main
   ```

2. **连接Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用GitHub账号登录
   - 点击 "New Project"
   - 选择您的GitHub仓库

3. **配置项目**
   - **Framework Preset**: Create React App
   - **Root Directory**: `./` (根目录)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

4. **设置环境变量**
   - 在项目设置中添加上述环境变量
   - 确保 `REACT_APP_API_BASE_URL` 指向正确的后端API

5. **部署**
   - 点击 "Deploy" 开始部署
   - 等待构建完成（通常2-5分钟）

### 方法二：Vercel CLI部署

1. **安装Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   # 在项目根目录执行
   vercel
   
   # 或者直接部署到生产环境
   vercel --prod
   ```

## 🔧 配置说明

### vercel.json配置
```json
{
  "version": 2,
  "name": "crypto-schelling-platform",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "headers": {
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 路由配置
- **静态资源缓存**: `/static/*` 文件缓存1年
- **SPA路由**: 所有路由都指向 `index.html`，支持React Router

## 🌐 后端API部署

### 选项1：Vercel Serverless Functions
如果您想将后端也部署到Vercel，可以创建 `api/` 目录：

```
api/
├── market-data.js         # 市场数据API
├── strategy.js           # 策略生成API
└── historical-data.js    # 历史数据API
```

### 选项2：其他云服务
- **Railway**: 适合Python后端
- **Heroku**: 经典选择
- **DigitalOcean App Platform**: 性价比高
- **AWS Lambda**: 企业级选择

## 📊 性能优化

### 1. 构建优化
```json
// package.json
{
  "scripts": {
    "build": "GENERATE_SOURCEMAP=false react-scripts build"
  }
}
```

### 2. 代码分割
项目已使用React.lazy进行代码分割，Vercel会自动优化。

### 3. 静态资源优化
- 图片压缩
- 字体优化
- CSS压缩

## 🔍 部署后验证

### 1. 功能测试
- [ ] 页面正常加载
- [ ] 策略生成功能
- [ ] 批量策略功能
- [ ] 图表显示正常
- [ ] 实时数据更新

### 2. 性能测试
- [ ] 首屏加载时间 < 3秒
- [ ] 图表渲染流畅
- [ ] API响应正常

### 3. 兼容性测试
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] 移动端浏览器

## 🚨 常见问题

### 1. 构建失败
```bash
# 检查依赖
npm install

# 本地构建测试
npm run build
```

### 2. API调用失败
- 检查 `REACT_APP_API_BASE_URL` 配置
- 确认后端API已部署并可访问
- 检查CORS配置

### 3. 路由404错误
- 确认 `vercel.json` 中的路由配置
- 检查React Router配置

### 4. 环境变量不生效
- 确保变量名以 `REACT_APP_` 开头
- 重新部署项目
- 检查Vercel控制台中的环境变量设置

## 📈 监控和维护

### 1. Vercel Analytics
启用Vercel Analytics监控网站性能：
```bash
npm install @vercel/analytics
```

### 2. 错误监控
集成Sentry或其他错误监控服务。

### 3. 自动部署
配置GitHub Actions实现CI/CD。

## 🎯 部署清单

- [ ] 代码推送到GitHub
- [ ] 创建Vercel项目
- [ ] 配置环境变量
- [ ] 设置自定义域名（可选）
- [ ] 配置SSL证书（自动）
- [ ] 测试所有功能
- [ ] 设置监控和告警

## 📞 支持

如果遇到部署问题，可以：
1. 查看Vercel部署日志
2. 检查浏览器控制台错误
3. 参考Vercel官方文档
4. 联系技术支持

---

🎉 **恭喜！您的加密货币合约谢林点交易策略平台已成功部署到Vercel！**
