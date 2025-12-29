import React from 'react';
import { PerformanceMonitor } from './PerformanceMonitor';

interface InfoPanelProps {
  starsCount: number;
  clustersCount: number;
  query: string;
  onExportSnapshot: () => void;
  onExportReferences: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  starsCount,
  clustersCount,
  query,
  onExportSnapshot,
  onExportReferences
}) => {
  return (
    <div className="info-panel">
      <div className="info-panel-content">
        {/* 左侧统计信息 */}
        <div className="stats-section">
          <div className="stats">
            <div className="stat-item">
              <span className="stat-label">星点数:</span>
              <span className="stat-value">{starsCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">星团数:</span>
              <span className="stat-value">{clustersCount}</span>
            </div>
            {query && (
              <div className="stat-item">
                <span className="stat-label">搜索词:</span>
                <span className="stat-value">{query}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 右侧性能监控 */}
        <div className="performance-section">
          <PerformanceMonitor />
        </div>
      </div>
      
      {/* 底部导出按钮 */}
      <div className="bottom-actions">
        <div className="export-buttons">
          <button onClick={onExportSnapshot} className="export-button">
            导出星图快照
          </button>
          <button onClick={onExportReferences} className="export-button">
            导出引用信息
          </button>
        </div>
      </div>
    </div>
  );
};
