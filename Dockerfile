# 合并的前后端Dockerfile - 支持ARM64架构
FROM --platform=linux/arm64 node:18-alpine AS frontend-builder

# 设置工作目录
WORKDIR /app

# 复制前端package文件
COPY package*.json ./

# 安装前端依赖（包括开发依赖，构建需要）
RUN npm ci

# 复制所有前端文件
COPY . ./

# 清理不需要的文件（保留node_modules用于构建）
RUN rm -rf backend-example .git

# 创建生产环境变量文件
RUN echo "REACT_APP_API_BASE_URL=/api" > .env.production
RUN echo "REACT_APP_APP_NAME=加密货币合约谢林点交易策略平台" >> .env.production

# 设置构建环境变量
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV NODE_ENV=production

# 验证npm和node版本
RUN node --version && npm --version

# 检查package.json和依赖
RUN ls -la && cat package.json | grep -A 10 '"scripts"'

# 检查node_modules是否存在
RUN ls -la node_modules | head -10

# 构建前端应用
RUN npm run build

# 生产阶段 - Python + Nginx
FROM --platform=linux/arm64 python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    gcc \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 设置Python环境变量
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# 复制后端requirements并安装Python依赖
COPY backend-example/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend-example/ ./

# 从前端构建阶段复制构建结果
COPY --from=frontend-builder /app/build /var/www/html

# 复制nginx配置
COPY nginx-combined.conf /etc/nginx/sites-available/default

# 创建supervisor配置
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 创建数据目录
RUN mkdir -p /app/data

# 创建nginx运行目录
RUN mkdir -p /var/run/nginx

# 设置权限
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health && curl -f http://localhost/api/health || exit 1

# 使用supervisor启动nginx和后端服务
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
