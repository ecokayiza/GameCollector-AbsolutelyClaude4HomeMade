#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Collection API Server
专门负责游戏记录数据的本地文件读写操作
"""

import json
import os
import base64
import time
import uuid
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

class GameCollectionAPIHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.data_dir = './data'
        self.images_dir = './data/images'
        self.games_file = './data/games.json'
        
        # 确保目录存在
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.images_dir, exist_ok=True)
        
        # 确保游戏数据文件存在
        if not os.path.exists(self.games_file):
            with open(self.games_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False)
        
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """处理预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """处理GET请求"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/games':
            self.get_games()
        elif parsed_path.path.startswith('/api/image/'):
            filename = parsed_path.path.split('/')[-1]
            self.get_image(filename)
        else:
            # 静态文件服务
            self.serve_static_file()
    
    def do_POST(self):
        """处理POST请求"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/games':
            self.add_game()
        else:
            self.send_error(404)
    
    def do_PUT(self):
        """处理PUT请求"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path.startswith('/api/games/'):
            game_id = parsed_path.path.split('/')[-1]
            self.update_game(game_id)
        else:
            self.send_error(404)
    
    def do_DELETE(self):
        """处理DELETE请求"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path.startswith('/api/games/'):
            game_id = parsed_path.path.split('/')[-1]
            self.delete_game(game_id)
        else:
            self.send_error(404)
    
    def get_games(self):
        """获取所有游戏数据"""
        try:
            with open(self.games_file, 'r', encoding='utf-8') as f:
                games = json.load(f)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = json.dumps(games, ensure_ascii=False, indent=2)
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"❌ 读取游戏数据失败: {str(e)}")
            self.send_error(500, "Internal server error")
    
    def add_game(self):
        """添加新游戏"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            game_data = json.loads(post_data.decode('utf-8'))
            
            # 生成唯一ID
            game_id = str(uuid.uuid4())
            
            # 处理图片
            image_filename = None
            if 'imageData' in game_data and game_data['imageData']:
                image_filename = self.save_image(game_data['imageData'], game_data.get('name', 'Unknown'))
            
            # 创建游戏记录
            game = {
                'id': game_id,
                'name': game_data.get('name', ''),
                'score': float(game_data.get('score', 0)),
                'category': game_data.get('category', 'OTHER'),
                'playTime': float(game_data.get('playTime', 0)) if game_data.get('playTime') else None,
                'recordDate': game_data.get('recordDate', datetime.now().isoformat()),
                'comment': game_data.get('comment', ''),
                'imagePath': image_filename,
                'imageUrl': f'/api/image/{image_filename}' if image_filename else None
            }
            
            # 读取现有数据
            with open(self.games_file, 'r', encoding='utf-8') as f:
                games = json.load(f)
            
            # 添加新游戏
            games.append(game)
            
            # 保存数据
            with open(self.games_file, 'w', encoding='utf-8') as f:
                json.dump(games, f, ensure_ascii=False, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = json.dumps(game, ensure_ascii=False, indent=2)
            self.wfile.write(response.encode('utf-8'))
            print(f"✅ 添加游戏成功: {game['name']} (ID: {game_id})")
            
        except Exception as e:
            print(f"❌ 添加游戏失败: {str(e)}")
            self.send_error(500, "Internal server error")
    
    def update_game(self, game_id):
        """更新游戏信息"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            game_data = json.loads(post_data.decode('utf-8'))
            
            # 读取现有数据
            with open(self.games_file, 'r', encoding='utf-8') as f:
                games = json.load(f)
            
            # 查找要更新的游戏
            game_index = -1
            for i, game in enumerate(games):
                if game['id'] == game_id:
                    game_index = i
                    break
            
            if game_index == -1:
                self.send_error(404, "Game not found")
                return
            
            existing_game = games[game_index]
            
            # 处理新图片
            image_filename = existing_game.get('imagePath')
            if 'imageData' in game_data and game_data['imageData']:
                # 删除旧图片
                if image_filename and os.path.exists(os.path.join(self.images_dir, image_filename)):
                    os.remove(os.path.join(self.images_dir, image_filename))
                
                # 保存新图片 - 优先使用新名称，否则使用现有游戏名称
                game_name = game_data.get('name') or existing_game.get('name') or game_id
                image_filename = self.save_image(game_data['imageData'], game_name)
            
            # 更新游戏信息
            updated_game = {
                'id': game_id,
                'name': game_data.get('name', existing_game.get('name', '')),
                'score': float(game_data.get('score', existing_game.get('score', 0))),
                'category': game_data.get('category', existing_game.get('category', 'OTHER')),
                'playTime': float(game_data.get('playTime', 0)) if game_data.get('playTime') else existing_game.get('playTime'),
                'recordDate': game_data.get('recordDate', existing_game.get('recordDate')),
                'comment': game_data.get('comment', existing_game.get('comment', '')),
                'imagePath': image_filename,
                'imageUrl': f'/api/image/{image_filename}' if image_filename else None
            }
            
            games[game_index] = updated_game
            
            # 保存数据
            with open(self.games_file, 'w', encoding='utf-8') as f:
                json.dump(games, f, ensure_ascii=False, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = json.dumps(games[game_index], ensure_ascii=False, indent=2)
            self.wfile.write(response.encode('utf-8'))
            print(f"✅ 更新游戏成功: {games[game_index]['name']} (ID: {game_id})")
        except Exception as e:
            print(f"❌ 更新游戏失败: {str(e)}")
            self.send_error(500, "Internal server error")
    
    def delete_game(self, game_id):
        """删除游戏"""
        try:
            # 读取现有数据
            with open(self.games_file, 'r', encoding='utf-8') as f:
                games = json.load(f)
            
            # 查找要删除的游戏
            game_index = -1
            for i, game in enumerate(games):
                if game['id'] == game_id:
                    game_index = i
                    break
            
            if game_index == -1:
                self.send_error(404, "Game not found")
                return
            game_name = games[game_index]['name']
            # 删除图片文件
            image_filename = games[game_index].get('imagePath')
            if image_filename and os.path.exists(os.path.join(self.images_dir, image_filename)):
                os.remove(os.path.join(self.images_dir, image_filename))
            
            # 从列表中删除游戏
            games.pop(game_index)
            
            # 保存数据
            with open(self.games_file, 'w', encoding='utf-8') as f:
                json.dump(games, f, ensure_ascii=False, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = json.dumps({'success': True}, ensure_ascii=False)
            self.wfile.write(response.encode('utf-8'))
            print(f"✅ 删除游戏成功: {game_name} (ID: {game_id})")
            
        except Exception as e:
            print(f"❌ 删除游戏失败: {str(e)}")
            self.send_error(500, "Internal server error")
    
    def get_image(self, filename):
        """获取图片文件"""
        try:
            image_path = os.path.join(self.images_dir, filename)
            
            if not os.path.exists(image_path):
                self.send_error(404, "Image not found")
                return
            
            # 确定MIME类型
            if filename.lower().endswith('.png'):
                content_type = 'image/png'
            elif filename.lower().endswith(('.jpg', '.jpeg')):
                content_type = 'image/jpeg'
            elif filename.lower().endswith('.gif'):
                content_type = 'image/gif'
            elif filename.lower().endswith('.webp'):
                content_type = 'image/webp'
            else:
                content_type = 'application/octet-stream'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            with open(image_path, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            print(f"❌ 获取图片失败: {str(e)}")
            self.send_error(500, "Internal server error")
    
    def save_image(self, image_data, game_name=None):
        """保存base64图片到文件"""
        try:
            # 解析base64数据
            if ',' in image_data:
                header, data = image_data.split(',', 1)
                # 从header中提取文件类型
                if 'image/png' in header:
                    ext = '.png'
                elif 'image/jpeg' in header or 'image/jpg' in header:
                    ext = '.jpg'
                elif 'image/gif' in header:
                    ext = '.gif'
                elif 'image/webp' in header:
                    ext = '.webp'
                else:
                    ext = '.png'  # 默认为PNG
            else:
                data = image_data
                ext = '.png'
            
            # 生成文件名 - 使用游戏名_时间戳格式
            timestamp = int(time.time())
            if game_name and game_name.strip():
                # 清理游戏名中的非法字符
                safe_name = "".join(c for c in game_name if c.isalnum() or c in (' ', '-', '_')).strip()
                safe_name = safe_name.replace(' ', '_')
                if safe_name:
                    filename = f"{safe_name}_{timestamp}{ext}"
                else:
                    filename = f"game_{timestamp}{ext}"
            else:
                filename = f"game_{timestamp}{ext}"
            
            filepath = os.path.join(self.images_dir, filename)
            
            # 解码并保存
            image_bytes = base64.b64decode(data)
            with open(filepath, 'wb') as f:
                f.write(image_bytes)
            
            return filename
            
        except Exception as e:
            print(f"❌ 保存图片失败: {str(e)}")
            raise
    
    def serve_static_file(self):
        """服务静态文件"""
        try:
            # 获取请求的文件路径
            file_path = self.path.strip('/')
            if not file_path or file_path == '/':
                file_path = 'index.html'
            
            # 安全检查：防止目录遍历
            if '..' in file_path or file_path.startswith('/'):
                self.send_error(403, "Access denied")
                return
            
            # 检查文件是否存在
            if not os.path.exists(file_path):
                self.send_error(404, "File not found")
                return
            
            # 确定MIME类型
            if file_path.endswith('.html'):
                content_type = 'text/html; charset=utf-8'
            elif file_path.endswith('.css'):
                content_type = 'text/css; charset=utf-8'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript; charset=utf-8'
            elif file_path.endswith('.json'):
                content_type = 'application/json; charset=utf-8'
            else:
                content_type = 'text/plain; charset=utf-8'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            print(f"❌ 服务静态文件失败: {str(e)}")
            self.send_error(500, "Internal server error")

def main():
    """启动服务器"""
    import sys
    
    host = 'localhost'
    # 从命令行参数获取端口，默认为8000
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    
    server = HTTPServer((host, port), GameCollectionAPIHandler)
    
    print("🚀 Game Collection API Server Started")
    print(f"📡 Server URL: http://{host}:{port}")
    print(f"💾 Data Directory: ./data/")
    print(f"🖼️ Images Directory: ./data/images/")
    print(f"📊 Game Data File: ./data/games.json")
    print(f"⏹️ Press Ctrl+C to stop server")
    print("--" * 25)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        server.server_close()

if __name__ == '__main__':
    main()
