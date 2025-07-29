#!/usr/bin/env python3
"""
Generate test content for output filtering verification
"""

def generate_test_content(lines=150):
    """Generate test content with the specified number of lines"""
    content = []
    
    content.append("# Test Long Note for Output Filtering")
    content.append("")
    content.append("This is a test note created to verify the output filtering implementation.")
    content.append("")
    
    # Add sections with numbered lines
    for section in range(1, (lines // 10) + 1):
        content.append(f"## Section {section}")
        content.append("")
        
        start_line = (section - 1) * 10 + 1
        end_line = min(section * 10, lines)
        
        for line_num in range(start_line, end_line + 1):
            content.append(f"Line {line_num}: This is test content line number {line_num}. "
                         f"Each line contains enough text to be meaningful. "
                         f"The filtering should activate after 100 lines or 10,000 characters.")
        
        content.append("")
    
    content.append("## End of Test Content")
    content.append(f"This note contains {lines} lines of content for testing output filtering.")
    
    return '\n'.join(content)

def main():
    # Generate content
    long_content = generate_test_content(150)
    short_content = generate_test_content(20)
    
    # Save to files
    with open('/tmp/test_long_content.txt', 'w') as f:
        f.write(long_content)
    
    with open('/tmp/test_short_content.txt', 'w') as f:
        f.write(short_content)
    
    print("✅ Generated test content files:")
    print("   - /tmp/test_long_content.txt (150 lines)")
    print("   - /tmp/test_short_content.txt (20 lines)")
    print()
    print("📋 Usage:")
    print("   Copy the content from these files when testing obsidian_note create")
    print()
    print(f"Long content preview (first 500 chars):")
    print(long_content[:500] + "...")
    print()
    print(f"Character count: {len(long_content):,} chars")
    print(f"Line count: {long_content.count(chr(10)) + 1} lines")

if __name__ == "__main__":
    main()
