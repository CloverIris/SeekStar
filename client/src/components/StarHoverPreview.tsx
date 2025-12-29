import { Html } from '@react-three/drei';
import type { StarPoint } from '../types';

interface StarHoverPreviewProps {
  hoveredStar: StarPoint | null;
  mouse?: { x: number; y: number }; // 标记为可选，因为未使用
}

export const StarHoverPreview = ({ hoveredStar }: StarHoverPreviewProps) => {
  if (!hoveredStar) return null;
  
  // 移除手动位置计算，使用Html组件自动处理
  return (
    <Html className="star-hover-preview" position={[hoveredStar.position.x, hoveredStar.position.y, hoveredStar.position.z]}>
      <h4>{hoveredStar.title || '未命名'}</h4>
      <p className="preview-author">作者: {(hoveredStar.author || []).join(', ') || '未知'}</p>
      <p className="preview-tags">
        {(hoveredStar.tags || []).slice(0, 3).map((tag, index) => (
          <span key={index} className="preview-tag">{tag}</span>
        ))}
      </p>
    </Html>
  );
};
