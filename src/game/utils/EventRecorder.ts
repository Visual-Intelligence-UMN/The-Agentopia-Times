import { analyzeEventLog, encodeEvent, type EventDetails, type EventLogAnalysis, type RecordedEvent } from './EventLogAnalysis';

export class EventRecorder {
  private startTime: number | null = null;
  private events: RecordedEvent[] = [];

  startRecord() {
    this.startTime = Date.now();
    this.events = [];
    console.log("Recording started at", new Date(this.startTime).toLocaleString());
  }

  recordEvent(log: string | EventDetails) {
    if (this.startTime === null) {
      console.warn("Recording has not started. Call startRecord() first.");
      return;
    }
    const currentTime = Date.now();
    const relativeTime = (currentTime - this.startTime) / 1000;
    const encodedLog = typeof log === 'string' ? log : encodeEvent(log);
    this.events.push({ time: relativeTime, log: encodedLog });
    console.log(`Event recorded: [${relativeTime.toFixed(2)}s]; ${encodedLog}`);
  }

  getAnalysis(): EventLogAnalysis {
    return analyzeEventLog(this.events);
  }

  endRecord(fileName: string = "events.csv") {
  if (this.startTime === null) {
    console.warn("Recording was never started.");
    return;
  }

  const csvHeader = "time,log\n";
  const csvRows = this.events
    .map(e => `${e.time.toFixed(2)},"${e.log.replace(/"/g, '""')}"`)
    .join("\n");

  const csvContent = csvHeader + csvRows;

  // 生成 Blob 并下载
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  const analysisBlob = new Blob([JSON.stringify(this.getAnalysis(), null, 2)], { type: 'application/json' });
  const analysisUrl = URL.createObjectURL(analysisBlob);
  const analysisLink = document.createElement('a');
  analysisLink.href = analysisUrl;
  analysisLink.download = fileName.replace(/\.csv$/i, '-analysis.json');
  analysisLink.click();
  URL.revokeObjectURL(analysisUrl);

  console.log("CSV download triggered:", fileName);
}

}
