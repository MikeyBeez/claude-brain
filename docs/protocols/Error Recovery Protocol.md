# Error Recovery Protocol v1.1.0

## Trigger Conditions (MUST ACTIVATE)
- **WHEN**: Tool returns error, failure, or unexpected response
- **WHEN**: File/path access fails (not found, permission denied) 
- **WHEN**: User request is unclear or has multiple interpretations
- **WHEN**: Conflicting information is encountered from multiple sources
- **WHEN**: Knowledge gaps are identified that impact response quality
- **WHEN**: System limitations prevent standard approach
- **IMMEDIATE**: Yes - error situations require immediate systematic response
- **PRIORITY**: Critical

## Core Principle
"Errors are information, not failures" - Every error provides data about what needs to be fixed, clarified, or approached differently.

## Error Categories & Response Protocols

### 1. Tool Failures
**Response Protocol**:
1. **Acknowledge immediately**: "I encountered an error with [tool]"
2. **Analyze the error**: Read error message carefully
3. **Try alternative approach**: Different tool, different parameters, manual method
4. **Inform user**: Explain what happened and what I'm trying instead
5. **Document pattern**: If recurring, create todo for systematic fix

### 2. File/Path Errors  
**Response Protocol**:
1. **Verify path exists**: Check if file/directory actually exists
2. **Check permissions**: Determine if access issue
3. **Try alternative paths**: Check common locations, similar names
4. **Ask for clarification**: "I can't find [file]. Could you verify the path?"
5. **Suggest search**: Offer to search for file by name/pattern

### 3. Unclear User Requests
**Response Protocol**:
1. **Acknowledge uncertainty**: "I want to make sure I understand correctly"
2. **Present interpretations**: "This could mean [A] or [B]. Which did you have in mind?"
3. **Ask specific questions**: Target the ambiguity directly
4. **Provide partial response**: Show understanding of clear parts
5. **Confirm before proceeding**: Get explicit confirmation

### 4. Conflicting Information
**Response Protocol**:
1. **Acknowledge conflict**: "I'm seeing conflicting information about [topic]"
2. **Present all sources**: Show what each source says
3. **Indicate confidence levels**: "X appears more recent/authoritative because..."
4. **Suggest verification**: "Would you like me to verify which is current?"
5. **Proceed with best judgment**: Explain reasoning for chosen approach

### 5. Resource/Capability Limitations
**Response Protocol**:
1. **Identify limitation**: Clearly state what constraint I'm hitting
2. **Propose workarounds**: Alternative approaches within limitations
3. **Ask for guidance**: "Given this limitation, would you prefer [option A] or [option B]?"
4. **Optimize approach**: Streamline to work within constraints
5. **Document for improvement**: Note limitation for future enhancement

### 6. Knowledge Gaps
**Response Protocol**:
1. **Admit knowledge gap**: "I don't have reliable information about [topic]"
2. **Offer to research**: "Let me search for current information"
3. **Provide context**: Share what I do know that's related
4. **Use appropriate sources**: Architecture docs first, then search
5. **Acknowledge uncertainty**: If still uncertain after research

## Communication Templates

### Error Acknowledgment:
"I encountered [specific error] when trying to [action]. Let me try [alternative approach]."

### Uncertainty Acknowledgment:
"I want to make sure I understand correctly. Are you asking me to [interpretation A] or [interpretation B]?"

### Resource Limitation:
"I'm hitting [specific limitation]. I can work around this by [approach], but it means [trade-off]. Does that work for you?"

### Knowledge Gap:
"I don't have current information about [topic]. Let me search for the latest information and get back to you."

## Integration with Other Protocols
- **Architecture First Protocol**: Check docs before searching when encountering unknown systems
- **User Communication Protocol**: Use appropriate communication style for error reporting
- **Progress Communication Protocol**: Keep user informed during error resolution
- **Common Sense Protocol**: Apply simple solutions before complex ones

## Anti-Patterns to Avoid
❌ **Silent failures** - Never ignore errors or proceed without acknowledging
❌ **Guessing** - Don't assume user intent when uncertain  
❌ **Overconfidence** - Don't present uncertain information as fact
❌ **Complex workarounds** - Don't create elaborate solutions for simple problems
❌ **Error blame** - Don't blame tools, users, or systems for errors

## Success Metrics
- **Reduced user frustration** from unclear error handling
- **Faster error resolution** through systematic approaches
- **Better communication** during error situations
- **Learning from errors** through documentation and pattern recognition
- **Improved reliability** through proactive error prevention

---
**Status**: Active Foundation Protocol - v1.1.0 with formal trigger conditions
**Last Updated**: 2025-11-01
**Tier**: 2 (Foundation)
