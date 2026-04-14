import { performance } from 'perf_hooks';
import http from 'http';

const PORT = 18964;
const HOST = '127.0.0.1';

async function verifyNoJsonInStream(text) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ text });
        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: '/grammar/parallel',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            }
        }, (res) => {
            let jsonFoundInRefine = false;
            let refineFound = false;

            res.on('data', chunk => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.type === 'full_analysis') {
                                refineFound = true;
                                console.log('--- RAW LLM OUTPUT START ---');
                                console.log(data.raw);
                                console.log('--- RAW LLM OUTPUT END ---');
                                if (data.refine && data.refine.includes('```json')) {
                                    jsonFoundInRefine = true;
                                }
                                console.log('[Full Analysis] Refine preview:', data.refine ? (data.refine.substring(0, 100) + '...') : 'null');
                            }
                        } catch (e) {}
                    }
                }
            });

            res.on('end', () => {
                resolve({ refineFound, jsonFoundInRefine });
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function run() {
    console.log("Verifying JSON stripping in SSE stream...");
    try {
        const result = await verifyNoJsonInStream("He go to school yesterday.");
        if (!result.refineFound) {
            console.log("❌ Refine section not found in stream.");
        } else if (result.jsonFoundInRefine) {
            console.log("❌ JSON block found in Refine section!");
        } else {
            console.log("✅ JSON block successfully stripped from Refine section.");
        }
    } catch (e) {
        console.error("Error connecting to server:", e.message);
    }
}

run();
