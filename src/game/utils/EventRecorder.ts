// EventRecorder.ts
export class EventRecorder {
    private startTime: number | null = null;
    private events: { time: number; log: string }[] = [];

    startRecord() {
        this.startTime = Date.now();
        this.events = [];
        console.log(
            'Recording started at',
            new Date(this.startTime).toLocaleString(),
        );
    }

    recordEvent(log: string) {
        if (this.startTime === null) {
            console.warn(
                'Recording has not started. Call startRecord() first.',
            );
            return;
        }
        const currentTime = Date.now();
        const relativeTime = (currentTime - this.startTime) / 1000;
        this.events.push({ time: relativeTime, log });
        console.log(`Event recorded: [${relativeTime.toFixed(2)}s]; ${log}`);
    }

    endRecord(fileName: string = 'events.csv') {
        if (this.startTime === null) {
            console.warn('Recording was never started.');
            return;
        }

        const csvHeader = 'time,log\n';
        const csvRows = this.events
            .map((e) => `${e.time.toFixed(2)},${e.log.replace(/,/g, ';')}`)
            .join('\n');

        const csvContent = csvHeader + csvRows;

        // 生成 Blob 并下载
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        console.log('CSV download triggered:', fileName);
    }
}
