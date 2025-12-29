import React from 'react';
import type { StarPoint } from '../types';

interface StarInfoPanelProps {
  star: StarPoint | null;
}

export const StarInfoPanel: React.FC<StarInfoPanelProps> = ({ star }) => {
  if (!star) return null;

  return (
    <div className="star-info-panel">
      <h3>{star?.title || '未命名'}</h3>
      <p className="star-author">作者: {(star?.author || []).join(', ') || '未知'}</p>
      <p className="star-content">{star?.content || '无内容'}</p>
      <div className="star-tags">
        {(star?.tags || []).map((tag, index) => (
          <span key={index} className="star-tag">{tag || ''}</span>
        ))}
      </div>
      <a 
        href={star?.url || '#'} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="star-url"
        onClick={(e) => {
          if (!star?.url) {
            e.preventDefault();
          }
        }}
      >
        查看原文
      </a>
    </div>
  );
};
