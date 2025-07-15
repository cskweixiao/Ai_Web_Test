import type { TestRun } from '../src/types/test';

export class TestRunStore {
  private runs = new Map<string, TestRun>();

  get(id: string)                 { return this.runs.get(id); }
  set(id: string, data: TestRun)  { this.runs.set(id, data); this.emit(id, data); }
  has(id: string)                 { return this.runs.has(id); }
  all()                           { return Array.from(this.runs.values()); }

  // 监听器——以后统一推 WebSocket/日志/DB
  private listeners: ((id:string, r:TestRun) => void)[] = [];
  onChange(fn:(id:string, r:TestRun) => void){ this.listeners.push(fn); }
  private emit(id: string, r: TestRun){ for (const fn of this.listeners) fn(id,r); }
}

export const testRunStore = new TestRunStore(); 