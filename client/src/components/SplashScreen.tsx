import React, { useEffect, useState } from 'react';
import type { StarPoint } from '../types';

interface SplashScreenProps {
  onSplashComplete: (stars: StarPoint[]) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onSplashComplete }) => {
  const [isSplashActive, setIsSplashActive] = useState(true);

  // 生成随机星点数据，用于开屏效果
  const generateRandomStars = (count: number): StarPoint[] => {
    const colors = ['#4ECDC4', '#FF6B6B', '#F7DC6F', '#9B59B6', '#3498DB', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    const tags = ['人工智能', '机器学习', '深度学习', '大数据', '云计算', '区块链', '物联网', '计算机视觉', '自然语言处理', '强化学习'];
    
    return Array.from({ length: count }, (_, index) => {
      // 生成球面上的随机位置，确保星点分布均匀
      const radius = Math.random() * 15 + 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      return {
        id: `random-star-${index}`,
        title: `随机星点 ${index + 1}`,
        url: 'https://example.com',
        source: 'random',
        content: '这是一个随机生成的星点，用于开屏效果',
        author: ['系统'],
        publishDate: new Date().toISOString(),
        tags: [tags[Math.floor(Math.random() * tags.length)], tags[Math.floor(Math.random() * tags.length)]],
        position: {
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi)
        },
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 0.8 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        clusterId: undefined,
        relatedStars: [],
        relevanceScore: Math.random(),
        qualityScore: Math.random()
      };
    });
  };

  useEffect(() => {
    // 生成开屏星图，包含50个随机星点
    const splashStars = generateRandomStars(50);
    
    // 延迟执行实际搜索，让用户先看到开屏效果
    const timer = setTimeout(() => {
      setIsSplashActive(false);
      onSplashComplete(splashStars);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onSplashComplete]);

  return isSplashActive ? (
    <div className="splash-screen">
      <div className="splash-content">
        <h2>欢迎使用 SeekStar</h2>
        <p>3D 星图搜索引擎正在加载...</p>
      </div>
    </div>
  ) : null;
};
