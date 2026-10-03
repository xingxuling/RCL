# README diagrams

The repository READMEs embed the checked-in SVG images so readers can view diagrams without a live Mermaid renderer. The corresponding .mmd files preserve the editable graph definitions.

The Native UI and architecture graphs are shared between the English and Chinese READMEs. Governed UI and Frontier graphs have separate translated labels.

To regenerate an SVG from its Mermaid source using the Mermaid CLI:

```bash
npx --package @mermaid-js/mermaid-cli mmdc -i docs/readme-diagrams/architecture.mmd -o docs/readme-diagrams/architecture.svg
```

Review the SVG before committing it. Keep diagram labels and authority/evidence boundaries consistent with the README text. Images contain only static SVG shapes and text.
