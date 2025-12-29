import React from 'react';

interface ControlGuideProps {
  onResetView: () => void;
}

export const ControlGuide: React.FC<ControlGuideProps> = ({ onResetView }) => {
  return (
    <div className="control-guide">
      <div className="control-guide-content">
        <div className="control-section">
          <h4>操作指南</h4>
          <div className="controls-grid">
            <div className="control-item">
              <span className="key">WASD</span>
              <span className="description">移动视角</span>
            </div>
            <div className="control-item">
              <span className="key">鼠标拖拽</span>
              <span className="description">旋转视角</span>
            </div>
            <div className="control-item">
              <span className="key">鼠标滚轮</span>
              <span className="description">缩放视角</span>
            </div>
            <div className="control-item">
              <span className="key">Ctrl</span>
              <span className="description">加速移动</span>
            </div>
            <div className="control-item">
              <span className="key">Shift</span>
              <span className="description">减速移动</span>
            </div>
            <div className="control-item">
              <span className="key">鼠标悬停</span>
              <span className="description">查看详情</span>
            </div>
          </div>
        </div>
        
        <div className="reset-view-section">
          <button 
            className="reset-view-btn"
            onClick={onResetView}
          >
            重制视角
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .control-guide {
          position: fixed;
          bottom: 20px;
          left: 20px;
          transform: none;
          z-index: 100;
          background: rgba(0, 10, 50, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(100, 200, 255, 0.2);
          min-width: 400px;
          max-width: 600px;
        }
        
        .control-guide-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 30px;
        }
        
        .control-section h4 {
          margin: 0 0 15px 0;
          color: #64C8FF;
          font-size: 16px;
          font-weight: 600;
          text-align: left;
        }
        
        .controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        
        .control-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }
        
        .key {
          background: rgba(100, 200, 255, 0.2);
          color: #64C8FF;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-family: monospace;
          min-width: 60px;
          text-align: center;
          border: 1px solid rgba(100, 200, 255, 0.3);
        }
        
        .description {
          color: rgba(255, 255, 255, 0.8);
        }
        
        .reset-view-section {
          display: flex;
          align-items: center;
        }
        
        .reset-view-btn {
          background: linear-gradient(135deg, rgba(100, 200, 255, 0.3) 0%, rgba(100, 200, 255, 0.4) 100%);
          color: white;
          border: 1px solid rgba(100, 200, 255, 0.4);
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(5px);
        }
        
        .reset-view-btn:hover {
          background: linear-gradient(135deg, rgba(100, 200, 255, 0.4) 0%, rgba(100, 200, 255, 0.6) 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(100, 200, 255, 0.3);
        }
        
        .reset-view-btn:active {
          transform: translateY(0);
        }
        
        @media (max-width: 768px) {
          .control-guide {
            min-width: auto;
            width: 90%;
            bottom: 10px;
            padding: 15px;
          }
          
          .control-guide-content {
            flex-direction: column;
            gap: 20px;
          }
          
          .controls-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          
          .control-item {
            font-size: 13px;
          }
          
          .key {
            min-width: 50px;
            padding: 3px 8px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};
