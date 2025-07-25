# 多阶段构建 Dockerfile

# 阶段 1: 构建前端
FROM node:18-alpine AS frontend-builder
WORKDIR /app

# 复制前端package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有前端文件（避免单独复制可能不存在的目录）
COPY . ./

# 清理不需要的文件
RUN rm -rf backend-example .git .github node_modules/.cache

# 重新安装依赖（确保干净的node_modules）
RUN npm install

# 设置构建环境变量
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV NODE_ENV=production

# 安装依赖
RUN npm install

# 调试信息
RUN echo "=== 检查文件结构 ===" && ls -la
RUN echo "=== 检查src目录 ===" && ls -la src/ || echo "src目录不存在"
RUN echo "=== 检查public目录 ===" && ls -la public/ || echo "public目录不存在"
RUN echo "=== 检查package.json ===" && cat package.json | grep -A 5 '"scripts"'
RUN echo "=== 检查node版本 ===" && node --version && npm --version

# 构建前端（带详细输出）
RUN npm run build --verbose

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
