import { execSync } from 'child_process';
import initializeLLMProviders from "../lib/llm-init.mjs";
import { performance } from "perf_hooks";

const targetFile = 'lib/igt_config.json';
const testInput = "He don't knows how to code properly.";
const llmManager = initializeLLMProviders();

async function runTest() {
    console.log(`Test Input: "${testInput}"\n`);
    
    // Get all commit hashes
    const hashes = execSync(`git log --format="%H" ${targetFile}`).toString().trim().split('\n');
    
    const uniqueSystemPrompts = [];
    let prevSystemPrompt = '';

    // Oldest to newest
    [...hashes].reverse().forEach(hash => {
        try {
            const content = execSync(`git show ${hash}:${targetFile}`).toString();
            const config = JSON.parse(content);
            const systemPrompt = config.Prompts?.SystemPrompt;
            
            if (systemPrompt && systemPrompt !== prevSystemPrompt) {
                const commitInfo = execSync(`git log -1 --format="%ad%n%s" ${hash}`).toString().trim().split('\n');
                uniqueSystemPrompts.push({
                    hash: hash.substring(0, 8),
                    date: commitInfo[0],
                    message: commitInfo[1],
                    prompt: systemPrompt
                });
                prevSystemPrompt = systemPrompt;
            }
        } catch (e) {}
    });

    console.log(`Found ${uniqueSystemPrompts.length} unique SystemPrompt versions.\n`);

    const results = [];

    // Run tests (Newest to Oldest)
    for (const state of uniqueSystemPrompts.reverse()) {
        console.log(`--- Testing Commit: ${state.hash} (${state.date}) ---`);
        console.log(`Message: ${state.message}`);
        
        const start = performance.now();
        try {
            const response = await llmManager.generateWithFallback(testInput, state.prompt, {
                taskType: "grammar"
            });
            const end = performance.now();
            const duration = ((end - start) / 1000).toFixed(2);
            
            console.log(`Response Time: ${duration}s`);
            results.push({
                hash: state.hash,
                message: state.message,
                duration,
                response: response.substring(0, 200) + "..." // Truncate for console
            });
        } catch (error) {
            console.error(`Error: ${error.message}`);
            results.push({ hash: state.hash, message: state.message, error: error.message });
        }
        console.log('-----------------------------------\n');
    }

    console.log("\n=== ALL HISTORICAL TESTS SUMMARY ===");
    console.table(results.map(r => ({
        Hash: r.hash,
        Time: r.duration ? `${r.duration}s` : 'FAILED',
        Message: r.message.substring(0, 50)
    })));
}

runTest().catch(console.error);
