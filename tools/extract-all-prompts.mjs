import { execSync } from 'child_process';
import fs from 'fs';

const targetFile = 'lib/igt_config.json';
const outputFile = 'docs/prompt-history.md';

console.log('Fetching git history for lib/igt_config.json...');

// Get all commit hashes that modified the file
const hashes = execSync(`git log --format="%H" ${targetFile}`).toString().trim().split('\n');

let fullMarkdown = '# Prompt Evolution History\n\nThis document tracks the historical changes to the core LLM prompts found in lib/igt_config.json.\n\n---\n';

let lastPromptsJson = '';

// Iterate from newest to oldest
hashes.forEach(hash => {
    try {
        const content = execSync(`git show ${hash}:${targetFile}`).toString();
        const config = JSON.parse(content);
        const prompts = config.Prompts;
        
        if (!prompts) return;

        const promptsJson = JSON.stringify(prompts);
        // We compare with the NEXT commit in the list (which is older in time) 
        // to see if this commit actually changed the prompts.
        // Actually, since we are going newest -> oldest, we can just compare with the previous iteration's prompts.
        // If they are the same, it means this older commit had the same prompts as the newer one we already logged.
        // Wait, that's backwards. We want to skip if it's the same as the one BEFORE it in time.
    } catch (e) {
        // Handle cases where file might not exist or be invalid JSON in very old commits
    }
});

// Let's do it properly: get all unique prompt states in chronological order then reverse for the doc.
const uniqueStates = [];
let prevPrompts = '';

// Reverse hashes to go oldest -> newest
[...hashes].reverse().forEach(hash => {
    try {
        const content = execSync(`git show ${hash}:${targetFile}`).toString();
        const config = JSON.parse(content);
        const prompts = config.Prompts;
        if (!prompts) return;
        
        const currentPrompts = JSON.stringify(prompts);
        if (currentPrompts !== prevPrompts) {
            const commitInfo = execSync(`git log -1 --format="%ad%n%s" ${hash}`).toString().trim().split('\n');
            uniqueStates.push({
                hash,
                date: commitInfo[0],
                message: commitInfo[1],
                prompts
            });
            prevPrompts = currentPrompts;
        }
    } catch (e) {}
});

// Now build markdown in reverse chronological order (newest first)
uniqueStates.reverse().forEach(state => {
    fullMarkdown += `\n## Commit ${state.hash.substring(0, 8)} - ${state.date}\n`;
    fullMarkdown += `**Commit Message**: ${state.message}\n\n`;

    for (const [key, value] of Object.entries(state.prompts)) {
        fullMarkdown += `### ${key}\n\`\`\`text\n${value}\n\`\`\`\n\n`;
    }

    fullMarkdown += '---\n';
});

fs.writeFileSync(outputFile, fullMarkdown);
console.log(`Extraction complete! ${uniqueStates.length} unique prompt versions saved to ${outputFile}`);
