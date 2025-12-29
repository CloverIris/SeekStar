import { useState, useEffect } from 'react';

interface PerformanceData {
  requestRate: number;       // 请求速率（请求/秒）
  bandwidth: number;         // 带宽使用（MB/秒）
  loadPressure: number;      // 负载压力（%）
  responseTime: number;      // 响应时间（毫秒）
  totalRequests: number;     // 已处理请求（个）
  starCount: number;         // 星点数量（个）
  timestamp: string;         // 数据时间戳
}

interface PerformanceMonitorProps {
  updateInterval?: number;   // 更新间隔（毫秒）
}

export const PerformanceMonitor = ({ updateInterval = 1000 }: PerformanceMonitorProps) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    requestRate: 0,
    bandwidth: 0,
    loadPressure: 0,
    responseTime: 0,
    totalRequests: 0,
    starCount: 0,
    timestamp: new Date().toISOString()
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 获取性能数据
  const fetchPerformanceData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 模拟API请求，实际项目中应替换为真实API
      // const response = await fetch('http://localhost:3000/api/v1/performance');
      // if (!response.ok) {
      //   throw new Error('Failed to fetch performance data');
      // }
      // const data = await response.json();
      
      // 模拟数据
      const mockData: PerformanceData = {
        requestRate: Math.floor(Math.random() * 100) + 50,
        bandwidth: parseFloat((Math.random() * 10 + 1).toFixed(1)),
        loadPressure: Math.floor(Math.random() * 50) + 20,
        responseTime: Math.floor(Math.random() * 200) + 50,
        totalRequests: Math.floor(Math.random() * 100000) + 50000,
        starCount: Math.floor(Math.random() * 5000) + 1000,
        timestamp: new Date().toISOString()
      };
      
      setPerformanceData(mockData);
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
      setError('无法获取性能数据');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 定时更新性能数据
  useEffect(() => {
    // 初始加载
    fetchPerformanceData();
    
    // 设置定时器
    const intervalId = setInterval(fetchPerformanceData, updateInterval);
    
    // 清理定时器
    return () => clearInterval(intervalId);
  }, [updateInterval]);
  
  // 获取状态颜色
  const getStatusColor = (value: number, thresholds: { warning: number; error: number }) => {
    if (value >= thresholds.error) return '#FF6B6B';
    if (value >= thresholds.warning) return '#FFD166';
    return '#06D6A0';
  };
  
  // 格式化大数字
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };
  
  return (
    <div className="performance-monitor">
      <h4>系统性能监控</h4>
      <div className="performance-grid">
        {/* 请求速率 */}
        <div className="performance-item">
          <div className="performance-label">请求速率</div>
          <div className="performance-value" style={{
            color: getStatusColor(performanceData.requestRate, { warning: 150, error: 200 })
          }}>
            {performanceData.requestRate} <span className="unit">req/s</span>
          </div>
        </div>
        
        {/* 带宽使用 */}
        <div className="performance-item">
          <div className="performance-label">带宽使用</div>
          <div className="performance-value" style={{
            color: getStatusColor(performanceData.bandwidth, { warning: 8, error: 15 })
          }}>
            {performanceData.bandwidth} <span className="unit">MB/s</span>
          </div>
          <div className="performance-bar">
            <div 
              className="performance-bar-fill" 
              style={{
                width: `${Math.min(performanceData.bandwidth / 20 * 100, 100)}%`,
                backgroundColor: getStatusColor(performanceData.bandwidth, { warning: 8, error: 15 })
              }}
            />
          </div>
        </div>
        
        {/* 负载压力 */}
        <div className="performance-item">
          <div className="performance-label">负载压力</div>
          <div className="performance-value" style={{
            color: getStatusColor(performanceData.loadPressure, { warning: 70, error: 90 })
          }}>
            {performanceData.loadPressure} <span className="unit">%</span>
          </div>
          <div className="performance-bar">
            <div 
              className="performance-bar-fill" 
              style={{
                width: `${performanceData.loadPressure}%`,
                backgroundColor: getStatusColor(performanceData.loadPressure, { warning: 70, error: 90 })
              }}
            />
          </div>
        </div>
        
        {/* 响应时间 */}
        <div className="performance-item">
          <div className="performance-label">响应时间</div>
          <div className="performance-value" style={{
            color: getStatusColor(performanceData.responseTime, { warning: 200, error: 500 })
          }}>
            {performanceData.responseTime} <span className="unit">ms</span>
          </div>
        </div>
        
        {/* 已处理请求 */}
        <div className="performance-item">
          <div className="performance-label">已处理请求</div>
          <div className="performance-value">
            {formatNumber(performanceData.totalRequests)}
          </div>
        </div>
        
        {/* 星点数量 */}
        <div className="performance-item">
          <div className="performance-label">星点数量</div>
          <div className="performance-value">
            {formatNumber(performanceData.starCount)}
          </div>
        </div>
      </div>
      
      {isLoading && <div className="performance-loading">加载中...</div>}
      {error && <div className="performance-error">{error}</div>}
    </div>
  );
};
