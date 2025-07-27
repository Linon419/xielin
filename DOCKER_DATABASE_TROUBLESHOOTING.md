# Docker数据库部署故障排除指南

## 🔍 问题描述

在Docker部署后看不到数据库文件的常见问题和解决方案。

## 📊 问题分析

### 原因1: Volume挂载路径不匹配

**问题**: 数据库文件创建在容器内的 `/app/crypto_platform.db`，但Volume挂载的是 `./data:/app/data`

**解决方案**: 已修复数据库路径配置

```python
# 修复前
class Database:
    def __init__(self, db_path: str = "crypto_platform.db"):  # 创建在 /app/crypto_platform.db

# 修复后  
class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.getenv('DATABASE_PATH', '/app/data/crypto_platform.db')  # 创建在 /app/data/
```

### 原因2: 数据目录权限问题

**检查方法**:
```bash
# 检查宿主机目录权限
ls -la ./data/

# 检查容器内目录权限
docker exec -it xielin-app ls -la /app/data/
```

**解决方案**:
```bash
# 修复宿主机目录权限
sudo chown -R $USER:$USER ./data/
chmod -R 755 ./data/
```

## 🛠️ 故障排除步骤

### 步骤1: 检查容器状态

```bash
# 查看容器是否运行
docker ps

# 查看容器日志
docker logs xielin-app

# 查看容器详细信息
docker inspect xielin-app
```

### 步骤2: 检查Volume挂载

```bash
# 查看Volume挂载情况
docker inspect xielin-app | grep -A 10 "Mounts"

# 应该看到类似输出:
# "Mounts": [
#     {
#         "Type": "bind",
#         "Source": "/path/to/your/project/data",
#         "Destination": "/app/data",
#         "Mode": "",
#         "RW": true,
#         "Propagation": "rprivate"
#     }
# ]
```

### 步骤3: 进入容器检查

```bash
# 进入容器
docker exec -it xielin-app bash

# 检查数据目录
ls -la /app/data/

# 检查数据库文件
ls -la /app/data/crypto_platform.db

# 检查数据库是否可访问
python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/crypto_platform.db')
cursor = conn.cursor()
cursor.execute('SELECT name FROM sqlite_master WHERE type=\"table\"')
print('Tables:', cursor.fetchall())
conn.close()
"
```

### 步骤4: 使用检查脚本

```bash
# 在宿主机运行检查脚本
python3 check-database.py

# 在容器内运行检查脚本
docker exec -it xielin-app python3 check-database.py
```

## 🔧 常见解决方案

### 解决方案1: 重新创建容器

```bash
# 停止并删除容器
docker-compose down

# 确保数据目录存在且权限正确
mkdir -p ./data ./logs
chmod 755 ./data ./logs

# 重新启动
docker-compose up -d
```

### 解决方案2: 手动创建数据库

```bash
# 进入容器
docker exec -it xielin-app bash

# 手动初始化数据库
cd /app
python3 -c "
from database import Database
db = Database('/app/data/crypto_platform.db')
print('Database initialized successfully')
"
```

### 解决方案3: 环境变量配置

在 `docker-compose.yml` 中添加数据库路径环境变量:

```yaml
services:
  xielin:
    environment:
      - DATABASE_PATH=/app/data/crypto_platform.db
      # ... 其他环境变量
```

## 📋 验证清单

- [ ] 容器正在运行 (`docker ps`)
- [ ] Volume正确挂载 (`docker inspect`)
- [ ] 宿主机 `./data/` 目录存在且可写
- [ ] 容器内 `/app/data/` 目录存在且可写
- [ ] 数据库文件存在 (`./data/crypto_platform.db`)
- [ ] 数据库文件可读写且包含表结构
- [ ] 应用日志无数据库相关错误

## 🚨 紧急恢复

如果数据库完全丢失:

```bash
# 1. 备份现有数据（如果有）
cp -r ./data ./data.backup.$(date +%Y%m%d_%H%M%S)

# 2. 重新初始化
docker-compose down
rm -rf ./data/*
docker-compose up -d

# 3. 等待初始化完成
docker logs -f xielin-app

# 4. 验证数据库
python3 check-database.py
```

## 📞 获取帮助

如果问题仍然存在:

1. 收集诊断信息:
   ```bash
   # 创建诊断报告
   echo "=== Docker Info ===" > diagnosis.txt
   docker --version >> diagnosis.txt
   docker-compose --version >> diagnosis.txt
   
   echo "=== Container Status ===" >> diagnosis.txt
   docker ps -a >> diagnosis.txt
   
   echo "=== Container Logs ===" >> diagnosis.txt
   docker logs xielin-app >> diagnosis.txt 2>&1
   
   echo "=== Volume Info ===" >> diagnosis.txt
   docker inspect xielin-app >> diagnosis.txt
   
   echo "=== Host Directory ===" >> diagnosis.txt
   ls -la ./data/ >> diagnosis.txt 2>&1
   ```

2. 提供诊断报告和具体错误信息
3. 说明操作系统和Docker版本
4. 描述部署步骤和配置
