# Docker 镜像优化指南

## 📊 镜像版本对比

| 版本 | Dockerfile | 预估大小 | 优化程度 | 推荐用途 |
|------|------------|----------|----------|----------|
| 标准版 | `Dockerfile` | ~1.5-2GB | 基准 | 完整功能，开发环境 |
| 优化版 | `Dockerfile.optimized` | ~800MB-1GB | 🟢 优化40-50% | 生产环境，平衡性能 |
| 极简版 | `Dockerfile.minimal` | ~400-600MB | 🟢🟢 优化60-70% | 资源受限环境 |

## 🚀 部署方式

### 1. 生产环境部署（推荐极简版）
```bash
# 使用预构建的极简版镜像
docker-compose up -d

# 或指定优化版本
sed -i 's/:latest/:main-optimized/g' docker-compose.yml
docker-compose up -d
```

### 2. 开发环境
```bash
# 使用开发配置
docker-compose -f docker-compose.dev.yml up --build
```

### 3. 本地构建测试
```bash
# 构建所有版本并对比大小
bash build-compare.sh

# 单独构建某个版本
docker build -f Dockerfile.minimal -t xielin:minimal .
```

## 🔧 优化技术详解

### 基础镜像优化
- **原始**: `python:3.11-slim` (~150MB)
- **优化**: `python:3.11-alpine` (~50MB)
- **节省**: ~100MB

### 多阶段构建优化
```dockerfile
# 前端构建阶段 - 完全丢弃
FROM node:18-alpine AS frontend-builder
# ... 构建前端

# 运行时阶段 - 只保留必要文件
FROM python:3.11-alpine AS runtime
COPY --from=frontend-builder /app/build/ /var/www/html/
```

### RUN 指令合并
```dockerfile
# 优化前 (3层)
RUN apk add nginx
RUN apk add curl  
RUN rm -rf /var/cache/apk/*

# 优化后 (1层)
RUN apk add --no-cache nginx curl && \
    rm -rf /var/cache/apk/*
```

### 缓存清理
```dockerfile
# NPM 缓存清理
RUN npm ci --only=production && \
    npm cache clean --force

# Python 缓存清理  
RUN pip install --no-cache-dir -r requirements.txt && \
    pip cache purge
```

## 📈 CI/CD 优化

### GitHub Actions 矩阵构建
- 并行构建 3 个版本
- 独立缓存策略
- 自动大小分析
- 智能标签管理

### 缓存策略
```yaml
cache-from: |
  type=gha,scope=${{ matrix.variant.name }}
  type=registry,ref=...buildcache-${{ matrix.variant.name }}
cache-to: |
  type=gha,mode=max,scope=${{ matrix.variant.name }}
```

## 🎯 最佳实践

### 1. 选择合适版本
- **资源充足**: 标准版 (功能完整)
- **生产环境**: 优化版 (平衡性能)  
- **资源受限**: 极简版 (最小体积)

### 2. 开发工作流
```bash
# 开发时使用快速构建版本
docker-compose -f docker-compose.dev.yml up --build

# 测试时验证极简版本
docker build -f Dockerfile.minimal -t test .
```

### 3. 监控镜像大小
```bash
# 查看镜像大小
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

# 分析镜像层
docker history xielin:minimal
```

## 🔍 故障排查

### 构建失败
```bash
# 检查依赖是否完整
docker build --no-cache -f Dockerfile.minimal .

# 查看构建日志
docker build -f Dockerfile.minimal -t debug --progress=plain .
```

### 运行时问题
```bash
# 进入容器调试
docker exec -it xielin-app sh

# 检查服务状态
docker logs xielin-app
```

## 📝 维护建议

1. **定期更新基础镜像**
   ```bash
   # 检查基础镜像更新
   docker pull python:3.11-alpine
   docker pull node:18-alpine
   ```

2. **监控镜像大小变化**
   - CI/CD 中集成大小检查
   - 设置大小增长阈值告警

3. **清理旧镜像**
   ```bash
   # 清理无用镜像
   docker system prune -a
   ```

## 🎉 效果总结

通过上述优化，Docker镜像体积预计减少 **60-70%**：
- 构建时间减少 40-50%
- 拉取时间减少 60-70%  
- 存储空间节省 60-70%
- 部署速度提升 50-60%