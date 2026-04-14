function extractSections(output) {
  const correctionMatch = output.match(/\*\*Correction\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const refineMatch = output.match(/\*\*Refine\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|```|$)/i);

  return {
    correction: correctionMatch ? correctionMatch[1].trim() : null,
    refine: refineMatch ? refineMatch[1].trim() : null
  };
}

const sample = `**Review**: Errors found.
**Correction**: He went to school yesterday.
**Refine**: Yesterday, he went to school.

\`\`\`json
{
  "diagnoses": []
}
\`\`\``;

console.log('Sample input length:', sample.length);
const result = extractSections(sample);
console.log('Refine section:', JSON.stringify(result.refine));
if (result.refine.includes('```json')) {
    console.log('❌ JSON still present!');
} else {
    console.log('✅ JSON stripped!');
}
