import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import type { StarPoint } from '../types';

interface NearbyStarsListProps {
  stars: StarPoint[];
  hoveredStar: StarPoint | null;
  onStarClick: (star: StarPoint) => void;
  cameraPosition: THREE.Vector3;
}

export const NearbyStarsList: React.FC<NearbyStarsListProps> = ({
  stars = [],
  hoveredStar,
  onStarClick,
  cameraPosition
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  
  // 计算临近的星点（距离相机最近的10个）
  const nearbyStars = useMemo(() => {
    if (!stars || stars.length === 0) return [];
    
    return [...stars]
      .filter(star => star && star.position && !star.id.startsWith('far-star-'))
      .sort((a, b) => {
        const distanceA = cameraPosition.distanceTo(
          new THREE.Vector3(a.position.x, a.position.y, a.position.z)
        );
        const distanceB = cameraPosition.distanceTo(
          new THREE.Vector3(b.position.x, b.position.y, b.position.z)
        );
        return distanceA - distanceB;
      })
      .slice(0, 10);
  }, [stars, cameraPosition]);
  
  // 根据侧栏宽度计算布局类型
  const getLayoutType = () => {
    if (sidebarWidth > 480) {
      return 'matrix-2x2'; // 2x2矩阵布局
    } else if (sidebarWidth > 320) {
      return 'matrix-1x2'; // 1x2布局
    } else {
      return 'single-column'; // 单列布局
    }
  };
  
  const layoutType = getLayoutType();
  
  // 切换展开/收起状态
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    // 根据展开状态调整侧栏宽度
    setSidebarWidth(isExpanded ? 280 : 500);
  };
  
  return (
    <div 
      className="nearby-stars-list"
      style={{
        width: sidebarWidth,
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* 标题栏 */}
      <div className="nearby-stars-header">
        <h3>临近星点 ({nearbyStars.length})</h3>
        <button 
          className="toggle-button"
          onClick={toggleExpand}
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      </div>
      
      {/* 星点列表 */}
      <div className="nearby-stars-container">
        {nearbyStars.length === 0 ? (
          <div className="empty-state">
            <p>没有找到临近星点</p>
          </div>
        ) : (
          <div className={`stars-grid ${layoutType}`}>
            {nearbyStars.map(star => {
              // 计算星点到相机的距离
              const distance = cameraPosition.distanceTo(
                new THREE.Vector3(star.position.x, star.position.y, star.position.z)
              );
              
              // 计算LOD级别
              let lod = 0;
              if (distance < 5) lod = 3;
              else if (distance < 10) lod = 2;
              else if (distance < 15) lod = 1;
              
              return (
                <div 
                  key={star.id} 
                  className={`star-item lod-${lod} ${hoveredStar?.id === star.id ? 'hovered' : ''}`}
                  onClick={() => onStarClick(star)}
                >
                  {/* 星点距离标签 */}
                  <div className="star-distance">
                    {distance.toFixed(1)} 单位
                  </div>
                  
                  {/* 星点标题 */}
                  <h4 className="star-title">{star.title || '未命名'}</h4>
                  
                  {/* 根据LOD级别显示不同信息 */}
                  {lod >= 2 && (
                    <p className="star-author">
                      {star.author?.join(', ') || '未知作者'}
                    </p>
                  )}
                  
                  {lod >= 3 && star.content && (
                    <p className="star-preview">
                      {star.content.substring(0, 80)}...
                    </p>
                  )}
                  
                  {/* 星点标签 */}
                  {star.tags && star.tags.length > 0 && (
                    <div className="star-tags">
                      {star.tags.slice(0, lod >= 3 ? 3 : 2).map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
