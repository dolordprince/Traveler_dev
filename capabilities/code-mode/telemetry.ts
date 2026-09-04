import { CodeModeTelemetry } from './types';

export class CodeModeTelemetryStore {
  private state: CodeModeTelemetry = {
    catalogSize: 0,
    sourceCounts: {},
    searchCount: 0,
    describeCount: 0,
    callCount: 0,
    codeModeEngaged: false,
    bridgeCalls: 0,
    assistantTurns: 0
  };

  engage(): void {
    this.state.codeModeEngaged = true;
  }

  setCatalogSize(size: number): void {
    this.state.catalogSize = size;
  }

  setSourceCount(source: string, count: number): void {
    this.state.sourceCounts[source] = count;
  }

  searched(): void {
    this.state.searchCount++;
  }

  described(): void {
    this.state.describeCount++;
  }

  called(): void {
    this.state.callCount++;
    this.state.bridgeCalls++;
  }

  assistantTurn(): void {
    this.state.assistantTurns++;
  }

  snapshot(): CodeModeTelemetry {
    return JSON.parse(JSON.stringify(this.state));
  }
}
