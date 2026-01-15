#!/usr/bin/env python3
"""
Brain Forget Tool - Delete specific memories from the Brain database
Created: 2025-08-19
"""

import sqlite3
import sys
import json
from datetime import datetime

def forget_memory(key_to_forget):
    """Delete a specific memory by key"""
    db_path = "/Users/bard/Code/Claude_Data/brain/brain.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # First check if the memory exists
        cursor.execute("SELECT key, type, value FROM memories WHERE key = ?", (key_to_forget,))
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ Memory '{key_to_forget}' not found")
            return False
        
        # Show what will be deleted
        print(f"Found memory: {result[0]} (type: {result[1]})")
        try:
            val = json.loads(result[2])
            print(f"Content preview: {str(val)[:200]}...")
        except:
            print(f"Content preview: {result[2][:200]}...")
        
        # Confirm deletion
        confirm = input(f"\n⚠️  Delete memory '{key_to_forget}'? (yes/no): ")
        
        if confirm.lower() == 'yes':
            cursor.execute("DELETE FROM memories WHERE key = ?", (key_to_forget,))
            conn.commit()
            print(f"✅ Memory '{key_to_forget}' deleted")
            
            # Log the deletion
            cursor.execute("""
                INSERT INTO memories (key, value, type, created_at) 
                VALUES (?, ?, ?, ?)
            """, (
                f"deletion_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                json.dumps({
                    "action": "deleted",
                    "key": key_to_forget,
                    "timestamp": datetime.now().isoformat(),
                    "reason": "Manual deletion via brain_forget"
                }),
                "system",
                datetime.now().isoformat()
            ))
            conn.commit()
            return True
        else:
            print("❌ Deletion cancelled")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()

def list_memories_matching(pattern):
    """List memories matching a pattern"""
    db_path = "/Users/bard/Code/Claude_Data/brain/brain.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT key, type, created_at 
            FROM memories 
            WHERE key LIKE ? 
            ORDER BY created_at DESC
            LIMIT 20
        """, (f"%{pattern}%",))
        
        results = cursor.fetchall()
        
        if results:
            print(f"\nFound {len(results)} memories matching '{pattern}':\n")
            for key, mem_type, created in results:
                print(f"  • {key} ({mem_type}) - {created[:10]}")
        else:
            print(f"No memories found matching '{pattern}'")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python brain_forget.py <memory_key>  # Delete specific memory")
        print("  python brain_forget.py --list <pattern>  # List matching memories")
        print("\nExample:")
        print("  python brain_forget.py old_project_data")
        print("  python brain_forget.py --list vault")
        sys.exit(1)
    
    if sys.argv[1] == "--list" and len(sys.argv) > 2:
        list_memories_matching(sys.argv[2])
    else:
        forget_memory(sys.argv[1])
