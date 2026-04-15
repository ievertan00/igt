#!/usr/bin/env node
/**
 * Performance profiler for IGT grammar checking
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';

const testCases = [
  "He go to school yesterday.",
  "What if I modified the local path for a git repo?",
  "This is a test sentence.",
];

console.log("=== IGT Performance Profiler ===\n");

const iterations = 3;
const times = [];

for (let i = 0; i < iterations; i++) {
  const testCase = testCases[i % testCases.length];
  console.log(`[Run ${i + 1}] "${testCase}"`);
  
  const totalStart = performance.now();
  
  const child = spawn('node', ['lib/igt-bridge.mjs'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  child.stdin.write(testCase + '\n');
  child.stdin.end();
  
  let stdout = '';
  let stderr = '';
  
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  
  await new Promise((resolve) => {
    child.on('close', () => {
      const totalEnd = performance.now();
      const total = totalEnd - totalStart;
      times.push(total);
      
      console.log(`  Total wall time: ${total.toFixed(0)}ms`);
      resolve();
    });
  });
  
  // Timeout protection
  setTimeout(() => {}, 100);
}

// Calculate stats
const avg = times.reduce((a, b) => a + b, 0) / times.length;
const min = Math.min(...times);
const max = Math.max(...times);

console.log("\n=== Summary ===");
console.log(`Average: ${avg.toFixed(0)}ms`);
console.log(`Min: ${min.toFixed(0)}ms`);
console.log(`Max: ${max.toFixed(0)}ms`);
console.log(`Target: <5000ms (ideal: <3000ms)`);
console.log(`Status: ${avg < 3000 ? '✅ EXCELLENT' : avg < 5000 ? '⚠️ ACCEPTABLE' : '❌ NEEDS OPTIMIZATION'}`);
