import { render, screen } from '@testing-library/react';
import App from '../App';
import '@testing-library/jest-dom';

// 模拟Three.js相关依赖
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: jest.fn(),
  useThree: jest.fn(() => ({
    camera: { 
      position: { x: 0, y: 0, z: 20 },
      projectionMatrix: new Float32Array(16),
      viewMatrix: new Float32Array(16)
    },
    mouse: { x: 0, y: 0 },
    gl: { domElement: { clientWidth: 800, clientHeight: 600 } }
  })),
  // 模拟Three.js的React组件
  ambientLight: () => <div data-testid="ambient-light" />,
  pointLight: () => <div data-testid="point-light" />,
  group: () => <div data-testid="group" />,
  points: () => <div data-testid="points" />,
  bufferGeometry: () => <div data-testid="buffer-geometry" />,
  bufferAttribute: () => <div data-testid="buffer-attribute" />,
  pointsMaterial: () => <div data-testid="points-material" />,
  mesh: () => <div data-testid="mesh" />,
  sphereGeometry: () => <div data-testid="sphere-geometry" />,
  meshBasicMaterial: () => <div data-testid="mesh-basic-material" />,
  line: () => <div data-testid="line" />,
  lineBasicMaterial: () => <div data-testid="line-basic-material" />,
  color: () => <div data-testid="color" />
}));

jest.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />
}));

jest.mock('three', () => ({
  Vector3: class Vector3 {
    x: number;
    y: number;
    z: number;
    
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
    
    add(v: Vector3) {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    }
    
    subtract(v: Vector3) {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    }
    
    multiplyScalar(s: number) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }
    
    distanceTo(v: Vector3) {
      return Math.sqrt(
        Math.pow(this.x - v.x, 2) +
        Math.pow(this.y - v.y, 2) +
        Math.pow(this.z - v.z, 2)
      );
    }
    
    lerpVectors(v1: Vector3, v2: Vector3, t: number) {
      this.x = v1.x + (v2.x - v1.x) * t;
      this.y = v1.y + (v2.y - v1.y) * t;
      this.z = v1.z + (v2.z - v1.z) * t;
      return this;
    }
    
    project(_camera: any) {
      // 模拟project方法，返回一个屏幕坐标
      return new Vector3(this.x / 100, this.y / 100, this.z / 100);
    }
    
    getWorldDirection(v: Vector3) {
      // 模拟getWorldDirection方法
      v.x = 0;
      v.y = 0;
      v.z = -1;
      return v;
    }
    
    crossVectors(a: Vector3, b: Vector3) {
      // 模拟crossVectors方法
      this.x = a.y * b.z - a.z * b.y;
      this.y = a.z * b.x - a.x * b.z;
      this.z = a.x * b.y - a.y * b.x;
      return this;
    }
    
    normalize() {
      // 模拟normalize方法
      const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      if (length > 0) {
        this.x /= length;
        this.y /= length;
        this.z /= length;
      }
      return this;
    }
  },
  Raycaster: jest.fn(() => ({
    setFromCamera: jest.fn(),
    intersectObject: jest.fn(() => [])
  })),
  AdditiveBlending: 'AdditiveBlending',
  BufferGeometry: class BufferGeometry {},
  BufferAttribute: class BufferAttribute {},
  Points: class Points {},
  PointsMaterial: class PointsMaterial {},
  Mesh: class Mesh {},
  SphereGeometry: class SphereGeometry {},
  MeshBasicMaterial: class MeshBasicMaterial {},
  Line: class Line {},
  LineBasicMaterial: class LineBasicMaterial {},
  Group: class Group {}
}));

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByText('SeekStar - 3D 星图搜索引擎')).toBeInTheDocument();
  });

  test('renders search input and button', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('搜索关键词...')).toBeInTheDocument();
    expect(screen.getByText('搜索')).toBeInTheDocument();
  });

  test('renders export buttons', () => {
    render(<App />);
    expect(screen.getByText('导出星图快照')).toBeInTheDocument();
    expect(screen.getByText('导出引用信息')).toBeInTheDocument();
  });
});
