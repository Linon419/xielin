#!/usr/bin/env python3
"""
数据库检查脚本
用于检查Docker部署后的数据库状态
"""

import os
import sqlite3
import sys
from pathlib import Path

def check_database_file(db_path):
    """检查数据库文件是否存在"""
    if os.path.exists(db_path):
        file_size = os.path.getsize(db_path)
        print(f"✅ 数据库文件存在: {db_path}")
        print(f"📊 文件大小: {file_size} bytes")
        return True
    else:
        print(f"❌ 数据库文件不存在: {db_path}")
        return False

def check_database_tables(db_path):
    """检查数据库表结构"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 获取所有表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print(f"📋 数据库表 ({len(tables)}个):")
        for table in tables:
            table_name = table[0]
            
            # 获取表的记录数
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            
            print(f"  - {table_name}: {count} 条记录")
            
            # 如果是用户表，显示用户信息
            if table_name == 'users':
                cursor.execute("SELECT username, email, created_at FROM users LIMIT 5")
                users = cursor.fetchall()
                if users:
                    print("    最近用户:")
                    for user in users:
                        print(f"      - {user[0]} ({user[1]}) - {user[2]}")
            
            # 如果是订阅表，显示订阅信息
            elif table_name == 'user_subscriptions':
                cursor.execute("SELECT symbol, COUNT(*) as count FROM user_subscriptions GROUP BY symbol LIMIT 5")
                subscriptions = cursor.fetchall()
                if subscriptions:
                    print("    热门订阅:")
                    for sub in subscriptions:
                        print(f"      - {sub[0]}: {sub[1]} 个用户")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ 检查数据库表失败: {e}")
        return False

def main():
    """主函数"""
    print("🔍 数据库状态检查工具")
    print("=" * 50)
    
    # 检查不同可能的数据库路径
    possible_paths = [
        "/app/data/crypto_platform.db",  # Docker容器内路径
        "./data/crypto_platform.db",    # 宿主机挂载路径
        "crypto_platform.db",           # 当前目录
        "backend-example/crypto_platform.db"  # 开发环境路径
    ]
    
    db_found = False
    
    for db_path in possible_paths:
        print(f"\n🔍 检查路径: {db_path}")
        
        if check_database_file(db_path):
            db_found = True
            print(f"\n📊 分析数据库: {db_path}")
            check_database_tables(db_path)
            break
        else:
            # 检查目录是否存在
            dir_path = os.path.dirname(db_path)
            if dir_path and os.path.exists(dir_path):
                print(f"📁 目录存在: {dir_path}")
                files = os.listdir(dir_path)
                if files:
                    print(f"📄 目录内容: {', '.join(files[:10])}")
                else:
                    print("📄 目录为空")
            elif dir_path:
                print(f"📁 目录不存在: {dir_path}")
    
    if not db_found:
        print("\n❌ 未找到数据库文件")
        print("\n💡 可能的原因:")
        print("1. Docker容器尚未启动或数据库未初始化")
        print("2. Volume挂载路径不正确")
        print("3. 数据库文件路径配置错误")
        print("\n🔧 解决方案:")
        print("1. 检查Docker容器是否正在运行: docker ps")
        print("2. 检查Volume挂载: docker inspect <container_name>")
        print("3. 查看容器日志: docker logs <container_name>")
        print("4. 进入容器检查: docker exec -it <container_name> bash")
        
        sys.exit(1)
    
    print(f"\n✅ 数据库检查完成")

if __name__ == "__main__":
    main()
