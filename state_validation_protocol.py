#!/usr/bin/env python3
"""
State Validation Protocol Implementation
Created: 2025-07-29
Purpose: Validate Brain state integrity, check JSON validity, verify memory counts
"""

import json
import sqlite3
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Any

class StateValidator:
    def __init__(self, brain_db_path: str = "/Users/bard/Code/claude-brain/data/brain.db"):
        self.brain_db_path = brain_db_path
        
    def validate_all(self) -> Dict[str, Any]:
        """Run all validation checks"""
        print("🔍 Starting State Validation Protocol...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "unknown",
            "checks": {}
        }
        
        # Check database connectivity
        results["checks"]["database"] = self._validate_database()
        
        # Check state table integrity
        results["checks"]["state_table"] = self._validate_state_table()
        
        # Check JSON integrity in state values
        results["checks"]["json_integrity"] = self._validate_json_integrity()
        
        # Overall status
        all_passed = all(
            check.get("status") == "pass" 
            for check in results["checks"].values()
        )
        results["overall_status"] = "pass" if all_passed else "fail"
        
        return results
    
    def _validate_database(self) -> Dict[str, Any]:
        """Check if database exists and is accessible"""
        try:
            if not Path(self.brain_db_path).exists():
                return {"status": "fail", "error": "Database file does not exist"}
            
            conn = sqlite3.connect(self.brain_db_path)
            cursor = conn.cursor()
            
            # Test basic query
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "status": "pass",
                "table_count": table_count,
                "db_size_mb": round(Path(self.brain_db_path).stat().st_size / 1024 / 1024, 2)
            }
            
        except Exception as e:
            return {"status": "fail", "error": str(e)}
    
    def _validate_state_table(self) -> Dict[str, Any]:
        """Validate state table structure and basic integrity"""
        try:
            conn = sqlite3.connect(self.brain_db_path)
            cursor = conn.cursor()
            
            # Check if state table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='state'")
            if not cursor.fetchone():
                return {"status": "fail", "error": "State table does not exist"}
            
            # Get row counts by category
            cursor.execute("SELECT category, COUNT(*) FROM state GROUP BY category")
            category_counts = dict(cursor.fetchall())
            
            # Get total count
            cursor.execute("SELECT COUNT(*) FROM state")
            total_rows = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "status": "pass",
                "total_rows": total_rows,
                "category_counts": category_counts
            }
            
        except Exception as e:
            return {"status": "fail", "error": str(e)}
    
    def _validate_json_integrity(self) -> Dict[str, Any]:
        """Check JSON integrity in state values"""
        try:
            conn = sqlite3.connect(self.brain_db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT key, category, value FROM state")
            rows = cursor.fetchall()
            
            corrupted_entries = []
            valid_json_count = 0
            
            for key, category, value in rows:
                try:
                    json.loads(value)
                    valid_json_count += 1
                except json.JSONDecodeError as e:
                    corrupted_entries.append({
                        "key": key,
                        "category": category,
                        "error": str(e)
                    })
            
            conn.close()
            
            status = "pass" if len(corrupted_entries) == 0 else "fail"
            
            return {
                "status": status,
                "total_entries": len(rows),
                "valid_json_count": valid_json_count,
                "corrupted_count": len(corrupted_entries),
                "corrupted_entries": corrupted_entries[:3]  # First 3 for brevity
            }
            
        except Exception as e:
            return {"status": "fail", "error": str(e)}

def main():
    """Run state validation and display results"""
    validator = StateValidator()
    results = validator.validate_all()
    
    print(f"\n📊 State Validation Results - {results['timestamp']}")
    print(f"🎯 Overall Status: {results['overall_status'].upper()}")
    print("-" * 60)
    
    for check_name, check_result in results["checks"].items():
        status_emoji = "✅" if check_result["status"] == "pass" else "❌"
        print(f"{status_emoji} {check_name.replace('_', ' ').title()}: {check_result['status']}")
        
        if check_result["status"] == "fail":
            print(f"   Error: {check_result.get('error', 'Unknown error')}")
        elif check_result.get("total_rows"):
            print(f"   Total rows: {check_result['total_rows']}")
    
    print("-" * 60)
    
    return 0 if results['overall_status'] == 'pass' else 1

if __name__ == "__main__":
    sys.exit(main())
