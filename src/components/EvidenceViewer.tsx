import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';

interface EvidenceViewerProps {
  runId: string;
}

interface ArtifactRecord {
  runId: string;
  type: 'trace' | 'video' | 'screenshot' | 'log';
  filename: string;
  size: number;
  createdAt: string;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ runId }) => {
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchArtifacts();
  }, [runId]);

  const fetchArtifacts = async () => {
    try {
      const response = await fetch(`/api/evidence/${runId}/files`);
      const data = await response.json();
      setArtifacts(data.data || []);
    } catch (error) {
      console.error('获取证据文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      setDownloading(filename);
      const response = await fetch(`/api/evidence/${runId}/sign/${filename}`);
      const data = await response.json();
      
      if (data.success) {
        // 创建下载链接
        const link = document.createElement('a');
        link.href = data.data.signedUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('下载失败:', error);
    } finally {
      setDownloading(null);
    }
  };

  // 🔥 修正：Trace Viewer使用绝对URL
  const handleViewTrace = async (filename: string) => {
    try {
      const response = await fetch(`/api/evidence/${runId}/sign/${filename}`);
      const data = await response.json();
      
      if (data.success) {
        // 使用绝对URL打开Trace Viewer
        const traceViewerUrl = `https://trace.playwright.dev/?trace=${encodeURIComponent(data.data.signedUrl)}`;
        window.open(traceViewerUrl, '_blank');
      }
    } catch (error) {
      console.error('打开Trace查看器失败:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trace': return '🔍';
      case 'video': return '📹';
      case 'screenshot': return '📸';
      case 'log': return '📝';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'trace': return 'text-blue-600 bg-blue-100';
      case 'video': return 'text-green-600 bg-green-100';
      case 'screenshot': return 'text-orange-600 bg-orange-100';
      case 'log': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="evidence-viewer p-4">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">加载证据文件中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="evidence-viewer p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">测试证据</h3>
        <Button onClick={fetchArtifacts} disabled={loading}>
          刷新
        </Button>
      </div>
      
      {artifacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          暂无证据文件
        </div>
      ) : (
        <div className="space-y-3">
          {artifacts.map((item, index) => (
            <div key={index} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getTypeIcon(item.type)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.filename}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(item.type)}`}>
                      {item.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>大小: {formatFileSize(item.size)}</div>
                    <div>创建时间: {new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {item.type === 'trace' && (
                  <Button
                    onClick={() => handleViewTrace(item.filename)}
                    size="sm"
                    variant="outline"
                  >
                    在线查看
                  </Button>
                )}
                <Button
                  onClick={() => handleDownload(item.filename)}
                  disabled={downloading === item.filename}
                  size="sm"
                >
                  {downloading === item.filename ? '下载中...' : '下载'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};