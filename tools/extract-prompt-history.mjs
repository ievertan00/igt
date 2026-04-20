import { execSync } from 'child_process';
import fs from 'fs';

const commits = [
    'e0639d6533f986ee50f5714f02c03d5779760ca8',
    '80a0ce172b3ef4e0c6f422728193e98ca68a3c2c',
    '029c7f048da77925f2a30fa9a7048eed94cf204a',
    '45ccb83b7152aafc92a0361cc5e215b03a8bb6d3',
    '399e1c65368c642fa65b91f08d9de44cbe920d28'
];

const outputFile = 'docs/prompt-history.md';

commits.forEach(hash => {
    console.log(`Extracting commit ${hash}...`);
    
    // Get commit info
    const commitInfo = execSync(`git log -1 --format="%ad%n%s" ${hash}`).toString().trim().split('\n');
    const date = commitInfo[0];
    const message = commitInfo[1];
    
    // Get file content at that commit
    const content = execSync(`git show ${hash}:lib/igt_config.json`).toString();
    const config = JSON.parse(content);
    const prompts = config.Prompts;
    
    let markdown = `\n## Commit ${hash.substring(0, 8)} - ${date}\n`;
    markdown += `**Commit Message**: ${message}\n\n`;
    
    for (const [key, value] of Object.entries(prompts)) {
        markdown += `### ${key}\n\`\`\`text\n${value}\n\`\`\`\n\n`;
    }
    
    markdown += '---\n';
    
    fs.appendFileSync(outputFile, markdown);
});

console.log('Extraction complete!');
