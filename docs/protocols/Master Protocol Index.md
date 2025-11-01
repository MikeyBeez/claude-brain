# Master Protocol Index v2.0.0

## Overview
This index catalogs all operational protocols in the Agent OS Protocol System. Each protocol defines systematic approaches for specific situations with clear triggers, procedures, and success metrics.

**Last Updated**: 2025-11-01
**Status**: Active - Foundation Protocols Complete

## Protocol Hierarchy

### Tier 0: Meta Protocols
Protocols that govern how protocols themselves work.

*Coming soon*

### Tier 1: System Protocols
Protocols that define fundamental system operation.

*Coming soon*

### Tier 2: Foundation Protocols ✅ COMPLETE
Protocols that must be considered for every interaction.

1. **Error Recovery Protocol** v1.1.0
   - **Purpose**: Systematic error/uncertainty handling with decision trees
   - **File**: `Error Recovery Protocol.md`
   - **Triggers**: Tool errors, file access failures, unclear requests, conflicting info, knowledge gaps
   - **Status**: ✅ Active

2. **User Communication Protocol** v1.1.0
   - **Purpose**: Context-adaptive user interaction framework
   - **File**: `User Communication Protocol.md`
   - **Triggers**: Any user interaction, feedback, confusion, multiple interpretations
   - **Status**: ✅ Active

3. **Task Approach Protocol** v1.1.0
   - **Purpose**: Intent analysis vs. literal request interpretation
   - **File**: `Task Approach Protocol.md`
   - **Triggers**: Any user request, ambiguous requests, underlying complexity
   - **Status**: ✅ Active

4. **Information Integration Protocol** v1.1.0
   - **Purpose**: Multi-source synthesis with conflict resolution
   - **File**: `Information Integration Protocol.md`
   - **Triggers**: Multiple sources needed, conflicting info, incomplete single source
   - **Status**: ✅ Active

5. **Progress Communication Protocol** v1.1.0
   - **Purpose**: User engagement during complex tasks
   - **File**: `Progress Communication Protocol.md`
   - **Triggers**: Tasks >30 seconds, >3 tool calls, multi-step approach, user decisions needed
   - **Status**: ✅ Active

### Tier 3: Workflow Protocols
Protocols for common task workflows and patterns.

*Coming soon*

## Protocol Creation Guidelines

### When to Create a New Protocol
- Recurring situation requires systematic approach
- Multiple decision points need clear guidance
- Quality varies significantly without structure
- Knowledge needs to be preserved systematically

### Protocol Template Structure
```markdown
# Protocol Name v1.0.0

## Trigger Conditions (MUST ACTIVATE)
- **WHEN**: [Specific condition]
- **IMMEDIATE**: [Yes/No]
- **PRIORITY**: [Critical/High/Medium/Low]

## Core Principle
[One sentence describing the fundamental approach]

## [Protocol-Specific Sections]

## Integration with Other Protocols
[How this protocol interacts with others]

## Anti-Patterns to Avoid
[Common mistakes to prevent]

## Success Metrics
[How to measure protocol effectiveness]

---
**Status**: [Active/Draft/Deprecated]
**Last Updated**: [Date]
**Tier**: [0-3]
```

## Protocol Interactions

### Foundation Protocol Integration
All foundation protocols work together:

```
Task Approach → Understand intent
    ↓
Information Integration → Gather comprehensive context
    ↓
Error Recovery → Handle issues systematically
    ↓
User Communication → Present appropriately
    ↓
Progress Communication → Keep user informed
```

## Usage Instructions

### For Every Request
1. Check if any foundation protocol triggers apply
2. Apply triggered protocols systematically
3. Integrate results from multiple protocols
4. Document protocol usage in complex cases

### For Protocol Development
1. Identify recurring situation without clear guidance
2. Draft protocol using template
3. Test protocol in real situations
4. Refine based on effectiveness
5. Add to appropriate tier in this index

## Roadmap

### Completed
- ✅ Foundation protocols (Tier 2) - All 5 complete
- ✅ Protocol index structure
- ✅ Protocol template

### In Progress
- 🔄 Meta protocols (Tier 0)
- 🔄 System protocols (Tier 1)
- 🔄 Workflow protocols (Tier 3)

### Planned
- Architecture integration protocols
- Tool usage protocols
- Memory management protocols
- Project management protocols
- Learning and adaptation protocols

## Version History

### v2.0.0 (2025-11-01)
- Created all 5 foundation protocols
- Established protocol file structure
- Defined protocol hierarchy
- Set up Master Protocol Index

### v1.0.0 (Previous)
- Initial protocol concept
- Basic protocol definitions
- MCP protocols server integration

---

**Note**: This index is maintained in the BrainVault to ensure protocols are discoverable and maintainable. The MCP protocols server provides runtime access, while these files serve as the source of truth.

## Repository Management Protocol

**CRITICAL**: When creating or updating protocols, ALWAYS:
1. Create/update protocol files in both locations:
   - BrainVault: `/Users/bard/Code/claude-brain/data/BrainVault/protocols/` (runtime access)
   - Repository: `/Users/bard/Code/claude-brain/docs/protocols/` (version control)
2. Stage changes: `git add docs/protocols/`
3. Commit with descriptive message: `git commit -m "Add/Update: [protocol names]"`
4. Push to remote: `git push`

This ensures protocols are preserved in version control and available for future sessions.
