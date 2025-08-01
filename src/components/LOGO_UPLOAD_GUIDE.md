# Logo上传替换指南

## 如何替换系统Logo

### 步骤1：准备Logo图片
- **推荐尺寸**: 256x256px 或更高分辨率的正方形图片
- **支持格式**: PNG（推荐，支持透明背景）、SVG、JPG
- **文件大小**: 建议小于500KB

### 步骤2：上传图片文件
1. 找到项目根目录下的 `public` 文件夹（路径：`D:\AI_mvp\ai_test\project\public\`）
2. 将您的logo图片文件放置到 `public` 文件夹中
3. 推荐文件名：`logo.png`、`logo.svg` 或 `logo.jpg`

### 步骤3：修改Logo组件
编辑文件：`src/components/Logo.tsx`

找到这一行：
```jsx
<TestTube className={`${iconSizes[size]} text-blue-600`} />
```

替换为：
```jsx
<img 
  src="/logo.png" 
  alt="公司Logo" 
  className={`${sizeClasses[size]} object-contain rounded-lg`} 
/>
```

### 步骤4：更新路径
根据您上传的文件名和路径，修改 `src` 属性：
- 如果文件在 `public/logo.png`，使用 `src="/logo.png"`
- 如果文件在 `public/assets/logo.svg`，使用 `src="/assets/logo.svg"`

### 完整示例
```jsx
// 替换前
<div className={`${sizeClasses[size]} bg-blue-100 rounded-lg flex items-center justify-center`}>
  <TestTube className={`${iconSizes[size]} text-blue-600`} />
</div>

// 替换后
<div className={`${sizeClasses[size]} bg-blue-100 rounded-lg flex items-center justify-center overflow-hidden`}>
  <img 
    src="/logo.png" 
    alt="公司Logo" 
    className={`${sizeClasses[size]} object-contain`} 
  />
</div>
```

### 注意事项
- Logo会自动适配三种尺寸：sm(32px)、md(40px)、lg(48px)
- 建议使用透明背景的PNG格式以获得最佳效果
- 如果logo是横向的，可能需要调整容器的宽度比例