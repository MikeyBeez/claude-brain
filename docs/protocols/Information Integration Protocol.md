# Information Integration Protocol v1.1.0

## Trigger Conditions (MUST ACTIVATE)
- **WHEN**: Information request requires multiple sources (Brain + Obsidian + Web + Files)
- **WHEN**: Conflicting information is detected between any sources
- **WHEN**: Single source is incomplete and user needs comprehensive response
- **WHEN**: User asks for researched, verified, or comprehensive information
- **WHEN**: Combining different information types (structured + unstructured, current + historical)
- **IMMEDIATE**: Yes - information conflicts must be resolved before presenting
- **PRIORITY**: High

## Core Principle
"Multiple sources strengthen truth when integrated systematically, but only when conflicts are resolved explicitly"

Modern AI assistance requires combining:
- Brain memory (persistent context)
- Obsidian notes (structured knowledge)
- Web search results (current information)
- File contents (specific data)
- User-provided information (immediate context)
- Internal knowledge (training data)

## Integration Framework

### Step 1: Source Collection Strategy
```
Define information need
├─ Check Brain memory first (instant access)
├─ Check Obsidian notes (structured knowledge)
├─ Check uploaded files (specific data)
├─ Search web if needed (current/missing info)
└─ Apply internal knowledge (fill gaps)
```

### Step 2: Conflict Resolution Matrix

When sources disagree:

| Conflict Type | Resolution Strategy |
|---------------|-------------------|
| Version/Recency | Prefer newer source, note temporal difference |
| Authority | Prefer primary source, note secondary source |
| Scope | Use source appropriate to user's context |
| Detail Level | Combine general + specific as appropriate |
| Opinion/Preference | Present multiple viewpoints with context |
| Factual Dispute | Research further or acknowledge uncertainty |

### Step 3: Synthesis Approach

**For Factual Information:**
1. Establish common ground (what all sources agree on)
2. Note significant differences with source attribution
3. Resolve conflicts using reliability ranking
4. Fill gaps with lower-confidence sources
5. Acknowledge remaining uncertainties

**For Procedural Information:**
1. Find the most complete procedure
2. Add details/alternatives from other sources
3. Note important variations or warnings
4. Prioritize based on user's specific context
5. Provide fallback approaches

**For Opinion/Analysis:**
1. Present the strongest/most relevant perspective first
2. Note alternative viewpoints with brief reasoning
3. Help user understand why perspectives differ
4. Provide framework for making their own decision

## Source-Specific Integration Rules

### Brain Memory Integration
- **Strengths**: Persistent user context, established preferences, project history
- **Limitations**: May be incomplete or outdated
- **Integration**: Use as primary context, supplement with current sources
- **Conflict handling**: User preferences override general advice

### Obsidian Notes Integration
- **Strengths**: Structured, curated, comprehensive within scope
- **Limitations**: May not cover current topic, could be stale
- **Integration**: Use as authoritative for covered topics
- **Conflict handling**: Obsidian usually wins over web search for established knowledge

### Web Search Integration
- **Strengths**: Current information, broad coverage, official sources
- **Limitations**: Variable quality, may be too general
- **Integration**: Use for current data, verification, gap filling
- **Conflict handling**: Web overrides internal knowledge for current events

### File Content Integration
- **Strengths**: User's specific data, complete within scope
- **Limitations**: May lack broader context
- **Integration**: Prioritize for user's specific case
- **Conflict handling**: User's data overrides general examples

### Internal Knowledge Integration
- **Strengths**: Broad, reliable, immediately available
- **Limitations**: Knowledge cutoff, may be outdated
- **Integration**: Use as baseline, supplement with current sources
- **Conflict handling**: Lower priority than verified external sources

## Quality Assurance Framework

### Before Presenting Integrated Information:

✅ **Consistency Check**
- Are there any remaining contradictions?
- Have I noted where sources disagree?
- Is the overall narrative coherent?

✅ **Completeness Check**
- Have I addressed all aspects of the user's question?
- Are there important warnings or caveats to include?
- What additional context would be helpful?

✅ **Attribution Check**
- Are claims properly attributed to sources?
- Is it clear which information comes from where?
- Have I noted confidence levels appropriately?

✅ **User Context Check**
- Is this synthesized information appropriate for their situation?
- Have I prioritized information relevant to their context?
- Would this help them succeed at their actual goal?

## Source Priority by Information Type
- **Current Events**: Web search → Internal knowledge
- **User Preferences**: Brain memory → General guidance
- **Technical Procedures**: Official docs → Experience reports → Forums
- **User's Specific Data**: Files → General examples
- **Established Knowledge**: Obsidian → Internal → Web verification

## Anti-Patterns to Avoid
🚫 **The Source Salad** - Dumping information from all sources without synthesis
🚫 **The False Authority** - Preferring sources based on availability rather than quality
🚫 **The Context Ignorer** - Treating all information as equally relevant
🚫 **The Conflict Avoider** - Hiding disagreements between sources
🚫 **The Over-Confident Synthesizer** - Claiming certainty when sources provide uncertainty

## Success Metrics
- User receives coherent, accurate information that accounts for relevant sources
- Conflicts are resolved transparently with clear reasoning
- Information quality improves with systematic source integration
- User can make informed decisions based on synthesized information

---
**Status**: Active Foundation Protocol - v1.1.0 with formal trigger conditions
**Last Updated**: 2025-11-01
**Tier**: 2 (Foundation)
