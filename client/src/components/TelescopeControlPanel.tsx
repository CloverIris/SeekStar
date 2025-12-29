import { useState, useEffect } from 'react';
import * as THREE from 'three';

interface TelescopeControlPanelProps {
  camera: THREE.PerspectiveCamera;
  onParamsChange: (params: { fov: number; distance: number }) => void;
}

interface Preset {
  id: string;
  name: string;
  fov: number;
  distance: number;
}

export const TelescopeControlPanel = ({ camera, onParamsChange }: TelescopeControlPanelProps) => {
  // 默认FOV值（与App.tsx中的初始设置一致）
  const defaultFov = 75;
  const defaultDistance = 20;
  
  // 状态管理
  const [fov, setFov] = useState(defaultFov);
  const [distance, setDistance] = useState(defaultDistance);
  const [fovInput, setFovInput] = useState(defaultFov.toString());
  const [distanceInput, setDistanceInput] = useState(defaultDistance.toString());
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  
  // 从本地存储加载预设
  useEffect(() => {
    const savedPresets = localStorage.getItem('telescopePresets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    } else {
      // 默认预设
      const defaultPresets: Preset[] = [
        { id: '1', name: '广角观测', fov: 120, distance: 50 },
        { id: '2', name: '标准观测', fov: 75, distance: 20 },
        { id: '3', name: '长焦观测', fov: 30, distance: 10 },
        { id: '4', name: '深空观测', fov: 15, distance: 5 }
      ];
      setPresets(defaultPresets);
      localStorage.setItem('telescopePresets', JSON.stringify(defaultPresets));
    }
  }, []);
  
  // 保存预设到本地存储
  const savePresetsToStorage = (updatedPresets: Preset[]) => {
    localStorage.setItem('telescopePresets', JSON.stringify(updatedPresets));
  };
  
  // 当相机参数变化时更新状态
  useEffect(() => {
    if (camera) {
      setFov(camera.fov);
      setFovInput(camera.fov.toString());
      // 计算相机到目标点的距离（假设目标点在原点）
      const cameraDistance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
      setDistance(cameraDistance);
      setDistanceInput(cameraDistance.toFixed(1));
    }
  }, [camera]);
  
  // 更新FOV
  const handleFovChange = (value: number) => {
    const newFov = Math.max(5, Math.min(180, value));
    setFov(newFov);
    setFovInput(newFov.toString());
    if (camera) {
      camera.fov = newFov;
      camera.updateProjectionMatrix();
      onParamsChange({ fov: newFov, distance });
    }
  };
  
  // 更新距离
  const handleDistanceChange = (value: number) => {
    const newDistance = Math.max(1, Math.min(200, value));
    setDistance(newDistance);
    setDistanceInput(newDistance.toFixed(1));
    if (camera) {
      // 保持相机朝向原点
      const direction = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camera.position).normalize();
      camera.position.copy(direction.multiplyScalar(newDistance));
      camera.lookAt(0, 0, 0);
      onParamsChange({ fov, distance: newDistance });
    }
  };
  
  // 处理FOV输入变化
  const handleFovInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFovInput(e.target.value);
  };
  
  // 处理距离输入变化
  const handleDistanceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDistanceInput(e.target.value);
  };
  
  // 应用输入值
  const applyInputs = () => {
    const parsedFov = parseFloat(fovInput);
    if (!isNaN(parsedFov)) {
      handleFovChange(parsedFov);
    }
    
    const parsedDistance = parseFloat(distanceInput);
    if (!isNaN(parsedDistance)) {
      handleDistanceChange(parsedDistance);
    }
  };
  
  // 使用预设
  const usePreset = (preset: Preset) => {
    handleFovChange(preset.fov);
    handleDistanceChange(preset.distance);
  };
  
  // 保存当前设置为新预设
  const saveCurrentAsPreset = () => {
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: `自定义预设 ${presets.length + 1}`,
      fov,
      distance
    };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    savePresetsToStorage(updatedPresets);
  };
  
  // 删除预设
  const deletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(preset => preset.id !== presetId);
    setPresets(updatedPresets);
    savePresetsToStorage(updatedPresets);
  };
  
  return (
    <div className="telescope-control-panel">
      <div className="panel-header">
        <h3>望远镜控制台</h3>
        <button 
          className="toggle-preview-btn" 
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? '关闭预览' : '显示预览'}
        </button>
      </div>
      
      <div className="panel-content">
        {/* 实时预览窗口 */}
        {showPreview && (
          <div className="preview-window">
            <div className="preview-header">
              <h4>实时预览</h4>
              <div className="preview-info">
                <span>FOV: {fov.toFixed(1)}°</span>
                <span>距离: {distance.toFixed(1)}</span>
              </div>
            </div>
            <div className="preview-canvas">
              {/* 这里可以添加一个小型Canvas或使用CSS渐变模拟星河背景 */}
              <div className="star-field-preview"></div>
              <div className="preview-overlay">
                <div className="crosshair"></div>
                <div className="field-indicator">
                  <div className="field-border"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 控制参数区域 */}
        <div className="control-section">
          <h4>观察参数</h4>
          
          {/* FOV调节 */}
          <div className="control-group">
            <label htmlFor="fov-slider">视场角 (FOV)</label>
            <div className="control-row">
              <input
                type="range"
                id="fov-slider"
                min="5"
                max="180"
                step="1"
                value={fov}
                onChange={(e) => handleFovChange(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="input-group">
                <input
                  type="number"
                  value={fovInput}
                  onChange={handleFovInputChange}
                  onBlur={applyInputs}
                  min="5"
                  max="180"
                  step="1"
                  className="number-input"
                />
                <span className="unit">°</span>
              </div>
            </div>
            <div className="range-labels">
              <span>5°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
          </div>
          
          {/* 距离调节 */}
          <div className="control-group">
            <label htmlFor="distance-slider">观察距离</label>
            <div className="control-row">
              <input
                type="range"
                id="distance-slider"
                min="1"
                max="200"
                step="1"
                value={distance}
                onChange={(e) => handleDistanceChange(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="input-group">
                <input
                  type="number"
                  value={distanceInput}
                  onChange={handleDistanceInputChange}
                  onBlur={applyInputs}
                  min="1"
                  max="200"
                  step="1"
                  className="number-input"
                />
                <span className="unit">单位</span>
              </div>
            </div>
            <div className="range-labels">
              <span>1</span>
              <span>100</span>
              <span>200</span>
            </div>
          </div>
        </div>
        
        {/* 预设管理 */}
        <div className="preset-section">
          <div className="preset-header">
            <h4>观测预设</h4>
            <button className="save-preset-btn" onClick={saveCurrentAsPreset}>
              保存当前设置
            </button>
          </div>
          <div className="preset-list">
            {presets.map(preset => (
              <div key={preset.id} className="preset-item">
                <div className="preset-info">
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-details">
                    FOV: {preset.fov}° | 距离: {preset.distance}
                  </span>
                </div>
                <div className="preset-actions">
                  <button 
                    className="use-preset-btn" 
                    onClick={() => usePreset(preset)}
                  >
                    使用
                  </button>
                  <button 
                    className="delete-preset-btn" 
                    onClick={() => deletePreset(preset.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
