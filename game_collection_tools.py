#!/usr/bin/env python3
"""
游戏记录收藏应用 - 辅助工具
用于批量处理图片和数据导入/导出
"""

import os
import json
import base64
import shutil
from datetime import datetime
from pathlib import Path
from PIL import Image
import argparse

class GameCollectionTools:
    def __init__(self, data_dir='./data'):
        self.data_dir = Path(data_dir)
        self.images_dir = self.data_dir / 'images'
        self.json_file = self.data_dir / 'games.json'
        
        # 确保目录存在
        self.data_dir.mkdir(exist_ok=True)
        self.images_dir.mkdir(exist_ok=True)
    
    def optimize_image(self, image_path, output_path=None, max_size=(800, 600), quality=85):
        """
        优化图片大小和质量
        """
        try:
            with Image.open(image_path) as img:
                # 转换为RGB模式（如果是RGBA）
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                
                # 计算新尺寸（保持宽高比）
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # 保存优化后的图片
                if output_path is None:
                    output_path = image_path
                
                img.save(output_path, 'JPEG', quality=quality, optimize=True)
                print(f"图片优化完成: {output_path}")
                return True
                
        except Exception as e:
            print(f"优化图片失败 {image_path}: {e}")
            return False
    
    def batch_optimize_images(self, source_dir, target_dir=None):
        """
        批量优化图片
        """
        source_path = Path(source_dir)
        if target_dir is None:
            target_path = self.images_dir
        else:
            target_path = Path(target_dir)
        
        target_path.mkdir(exist_ok=True)
        
        supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        processed = 0
        
        for img_file in source_path.rglob('*'):
            if img_file.suffix.lower() in supported_formats:
                output_file = target_path / f"{img_file.stem}_optimized.jpg"
                if self.optimize_image(img_file, output_file):
                    processed += 1
        
        print(f"批量优化完成，处理了 {processed} 张图片")
    
    def image_to_base64(self, image_path):
        """
        将图片转换为base64字符串
        """
        try:
            with open(image_path, 'rb') as img_file:
                img_data = img_file.read()
                base64_str = base64.b64encode(img_data).decode('utf-8')
                # 检测文件类型
                if image_path.lower().endswith(('.png', '.gif')):
                    mime_type = f"image/{image_path.suffix[1:].lower()}"
                else:
                    mime_type = "image/jpeg"
                return f"data:{mime_type};base64,{base64_str}"
        except Exception as e:
            print(f"转换图片失败 {image_path}: {e}")
            return None
    
    def create_sample_data(self):
        """
        创建示例数据
        """
        sample_games = [
            {
                "id": "sample1",
                "name": "示例游戏 1",
                "score": 8.5,
                "category": "RPG",
                "playTime": 45.5,
                "recordDate": "2024-01-15T20:30:00",
                "comment": "这是一款非常好玩的RPG游戏，剧情丰富，画面精美。",
                "imagePath": None,
                "imageData": None
            },
            {
                "id": "sample2", 
                "name": "示例游戏 2",
                "score": 7.2,
                "category": "ACT",
                "playTime": 12.0,
                "recordDate": "2024-02-10T14:15:00",
                "comment": "动作游戏，操作手感不错，但剧情略显薄弱。",
                "imagePath": None,
                "imageData": None
            },
            {
                "id": "sample3",
                "name": "示例游戏 3", 
                "score": 9.1,
                "category": "ADV",
                "playTime": 8.5,
                "recordDate": "2024-03-05T16:45:00",
                "comment": "优秀的冒险游戏，故事引人入胜，推荐！",
                "imagePath": None,
                "imageData": None
            }
        ]
        
        # 保存示例数据
        with open(self.json_file, 'w', encoding='utf-8') as f:
            json.dump(sample_games, f, ensure_ascii=False, indent=2)
        
        print(f"示例数据已创建: {self.json_file}")
    
    def export_data(self, output_file=None):
        """
        导出游戏数据到JSON文件
        """
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"game_collection_backup_{timestamp}.json"
        
        try:
            if self.json_file.exists():
                shutil.copy2(self.json_file, output_file)
                print(f"数据导出成功: {output_file}")
            else:
                print("没有找到游戏数据文件")
        except Exception as e:
            print(f"导出数据失败: {e}")
    
    def import_data(self, input_file):
        """
        从JSON文件导入游戏数据
        """
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 验证数据格式
            if not isinstance(data, list):
                print("错误：数据格式不正确，应该是游戏记录的数组")
                return False
            
            # 备份现有数据
            if self.json_file.exists():
                backup_file = f"games_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                shutil.copy2(self.json_file, self.data_dir / backup_file)
                print(f"现有数据已备份: {backup_file}")
            
            # 导入新数据
            with open(self.json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print(f"数据导入成功，共 {len(data)} 条记录")
            return True
            
        except Exception as e:
            print(f"导入数据失败: {e}")
            return False
    
    def cleanup_unused_images(self):
        """
        清理未使用的图片文件
        """
        try:
            # 读取游戏数据
            if not self.json_file.exists():
                print("没有找到游戏数据文件")
                return
            
            with open(self.json_file, 'r', encoding='utf-8') as f:
                games = json.load(f)
            
            # 获取所有使用中的图片文件
            used_images = set()
            for game in games:
                if game.get('imagePath') and not game['imagePath'].startswith('data:'):
                    used_images.add(Path(game['imagePath']).name)
            
            # 检查images目录中的文件
            if self.images_dir.exists():
                removed_count = 0
                for img_file in self.images_dir.iterdir():
                    if img_file.is_file() and img_file.name not in used_images:
                        img_file.unlink()
                        removed_count += 1
                        print(f"删除未使用的图片: {img_file.name}")
                
                print(f"清理完成，删除了 {removed_count} 个未使用的图片文件")
            
        except Exception as e:
            print(f"清理图片失败: {e}")
    
    def show_statistics(self):
        """
        显示统计信息
        """
        try:
            if not self.json_file.exists():
                print("没有找到游戏数据文件")
                return
            
            with open(self.json_file, 'r', encoding='utf-8') as f:
                games = json.load(f)
            
            if not games:
                print("没有游戏记录")
                return
            
            # 基本统计
            total_games = len(games)
            total_playtime = sum(game.get('playTime', 0) for game in games)
            avg_score = sum(game.get('score', 0) for game in games) / total_games
            
            # 分类统计
            categories = {}
            for game in games:
                cat = game.get('category', 'OTHER')
                categories[cat] = categories.get(cat, 0) + 1
            
            # 年份统计
            years = {}
            for game in games:
                try:
                    year = datetime.fromisoformat(game['recordDate']).year
                    years[year] = years.get(year, 0) + 1
                except:
                    pass
            
            print("\n=== 游戏收藏统计 ===")
            print(f"总游戏数: {total_games}")
            print(f"总游戏时长: {total_playtime:.1f} 小时")
            print(f"平均评分: {avg_score:.1f}")
            
            print("\n分类分布:")
            for cat, count in sorted(categories.items()):
                print(f"  {cat}: {count} 个游戏")
            
            print("\n年份分布:")
            for year, count in sorted(years.items(), reverse=True):
                print(f"  {year}: {count} 个游戏")
            
        except Exception as e:
            print(f"获取统计信息失败: {e}")

def main():
    parser = argparse.ArgumentParser(description='游戏记录收藏应用 - 辅助工具')
    parser.add_argument('--data-dir', default='./data', help='数据目录路径')
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 优化图片命令
    opt_parser = subparsers.add_parser('optimize', help='批量优化图片')
    opt_parser.add_argument('source_dir', help='源图片目录')
    opt_parser.add_argument('--target-dir', help='目标目录（可选）')
    
    # 创建示例数据命令
    subparsers.add_parser('create-sample', help='创建示例数据')
    
    # 导出数据命令
    export_parser = subparsers.add_parser('export', help='导出游戏数据')
    export_parser.add_argument('--output', help='输出文件名（可选）')
    
    # 导入数据命令
    import_parser = subparsers.add_parser('import', help='导入游戏数据')
    import_parser.add_argument('input_file', help='输入JSON文件')
    
    # 清理命令
    subparsers.add_parser('cleanup', help='清理未使用的图片')
    
    # 统计命令
    subparsers.add_parser('stats', help='显示统计信息')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    tools = GameCollectionTools(args.data_dir)
    
    if args.command == 'optimize':
        tools.batch_optimize_images(args.source_dir, args.target_dir)
    elif args.command == 'create-sample':
        tools.create_sample_data()
    elif args.command == 'export':
        tools.export_data(args.output)
    elif args.command == 'import':
        tools.import_data(args.input_file)
    elif args.command == 'cleanup':
        tools.cleanup_unused_images()
    elif args.command == 'stats':
        tools.show_statistics()

if __name__ == '__main__':
    main()
