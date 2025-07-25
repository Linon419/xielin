# 多阶段构建 Dockerfile

# 阶段 1: 构建前端
FROM node:18-alpine AS frontend-builder
WORKDIR /app

# 增加Node.js内存限制
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 复制前端package文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制前端文件（现在public/目录已经在Git中了！）
COPY public/ public/

# 复制src目录
COPY src/ src/

# 复制其他必要文件
COPY tsconfig.json ./

# 验证关键文件存在
RUN echo "=== 验证文件结构 ===" && ls -la public/ && echo "index.html exists: $(test -f public/index.html && echo 'YES' || echo 'NO')"

# 设置构建环境变量
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV NODE_ENV=production

# 构建前端
RUN npm run build

# 验证构建结果
RUN ls -la build/ && echo "Frontend build successful!"

# 阶段 2: 设置Python API服务器
FROM python:3.11-slim
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    gcc \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# 设置Python环境变量
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV NODE_ENV=production

# 复制后端代码
COPY backend-example/ ./

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 创建前端文件目录
RUN mkdir -p /var/www/html

# 从前一阶段复制构建好的前端文件
COPY --from=frontend-builder /app/build/ /var/www/html/

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
