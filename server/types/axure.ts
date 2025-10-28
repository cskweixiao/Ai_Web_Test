/**
 * Axure HTML解析相关类型定义
 */

export interface AxureParseResult {
  sessionId: string;
  pageCount: number;
  elementCount: number;
  interactionCount: number;
  pages: AxurePage[];
}

export interface AxurePage {
  name: string;
  url: string;
  elements: AxureElement[];
  interactions: AxureInteraction[];
}

export interface AxureElement {
  id: string;
  type: string;
  name?: string;
  placeholder?: string;
  text?: string;
  value?: string;
}

export interface AxureInteraction {
  type: string;
  trigger: string;
  target?: string;
  action?: string;
}
