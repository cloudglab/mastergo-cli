# Multi-Page Workflow

Build complete websites from MasterGo designs with multiple pages.

## Workflow

### 1. Analyze Entry Page

Use the section-first workflow for the entry page:

```bash
mastergo design-sections "https://mastergo.com/goto/xxx"
```

Look for:
- Section count and page boundaries
- `interactive` navigation targets
- Page structure and components

### 2. Fetch All Sections

Fetch every section in batches of 3-5:

```bash
mastergo design-sections "https://mastergo.com/goto/xxx" --section-index 0
mastergo design-sections "https://mastergo.com/goto/xxx" --section-index 1
```

### 3. Complete Visual Fidelity

After all sections are fetched, get both SVG and text data:

```bash
mastergo design-svgs "https://mastergo.com/goto/xxx"
mastergo design-texts "https://mastergo.com/goto/xxx"
```

### 4. Extract Navigation Targets

From the section data, find all `interactive` fields with `type: navigation`.
Each `targetLayerId` points to another page.

### 5. Fetch Each Page

For each `targetLayerId`, repeat the same section-first workflow.

### 6. Build Page Graph

```
Entry (0:1)
├── navigates to → Page 2 (0:2)
├── navigates to → Page 3 (0:3)
│   └── navigates to → Page 4 (0:4)
└── navigates to → Page 5 (0:5)
```

Track visited layerIds to avoid cycles.

## Implementation Order

1. **Shared components first**: header, footer, navigation
2. **Entry page**: main landing page
3. **Sub-pages**: in dependency order or parallel
