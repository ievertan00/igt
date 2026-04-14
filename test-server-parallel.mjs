import http from "http";

const PORT = 18964;
const HOST = "127.0.0.1";

async function testParallel() {
  const payload = JSON.stringify({ text: "He go to school yesterday." });
  
  const req = http.request({
    hostname: HOST,
    port: PORT,
    path: "/grammar/parallel",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    res.on("data", (chunk) => {
      const text = chunk.toString();
      console.log(`Received: ${text}`);
    });
    
    res.on("end", () => {
      console.log("Stream ended.");
    });
  });
  
  req.on("error", (e) => {
    console.error(`Problem with request: ${e.message}`);
  });
  
  req.write(payload);
  req.end();
}

console.log("Starting test...");
testParallel();
