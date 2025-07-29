#!/usr/bin/env python3
"""
Service Health Check Protocol Implementation
Created: 2025-07-29
Purpose: Check health of all MCP services before operations
"""

import subprocess
import json
import sys
from datetime import datetime
from typing import Dict, List, Any

class ServiceHealthChecker:
    def __init__(self):
        self.results = {}
        
    def check_all_services(self) -> Dict[str, Any]:
        """Run health checks on all services"""
        print("🏥 Running Service Health Checks...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "unknown",
            "services": {}
        }
        
        # Check individual services
        results["services"]["ollama"] = self._check_ollama()
        results["services"]["brain"] = self._check_brain_mcp()
        results["services"]["elvis"] = self._check_elvis()
        results["services"]["contemplation"] = self._check_contemplation()
        results["services"]["tools_registry"] = self._check_tools_registry()
        
        # Overall status
        all_critical_up = all(
            svc.get("status") == "up" 
            for name, svc in results["services"].items()
            if svc.get("critical", True)
        )
        
        results["overall_status"] = "healthy" if all_critical_up else "degraded"
        
        return results
    
    def _check_ollama(self) -> Dict[str, Any]:
        """Check Ollama service availability"""
        try:
            result = subprocess.run([
                "curl", "-s", "--connect-timeout", "3", 
                "http://localhost:11434/api/tags"
            ], capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout)
                    models = data.get("models", [])
                    return {
                        "status": "up",
                        "critical": True,
                        "models_count": len(models),
                        "models": [m.get("name", "unknown") for m in models[:3]]
                    }
                except json.JSONDecodeError:
                    return {
                        "status": "degraded",
                        "critical": True,
                        "error": "Invalid JSON response"
                    }
            else:
                return {
                    "status": "down", 
                    "critical": True,
                    "error": f"Connection failed: {result.stderr}"
                }
                
        except Exception as e:
            return {
                "status": "down",
                "critical": True, 
                "error": str(e)
            }
    
    def _check_brain_mcp(self) -> Dict[str, Any]:
        """Check Brain MCP service (implicit check via file existence)"""
        try:
            # Check if brain database exists
            import os
            brain_db = "/Users/bard/Code/claude-brain/data/brain.db"
            
            if os.path.exists(brain_db):
                size_mb = round(os.path.getsize(brain_db) / 1024 / 1024, 2)
                return {
                    "status": "up",
                    "critical": True,
                    "db_size_mb": size_mb,
                    "note": "MCP service implicit (built-in)"
                }
            else:
                return {
                    "status": "down",
                    "critical": True,
                    "error": "Brain database not found"
                }
                
        except Exception as e:
            return {
                "status": "unknown",
                "critical": True,
                "error": str(e)
            }
    
    def _check_elvis(self) -> Dict[str, Any]:
        """Check ELVIS service (via simple process check)"""
        try:
            # ELVIS is stateless, so check if Ollama is accessible (ELVIS dependency)
            ollama_check = self._check_ollama()
            
            if ollama_check["status"] == "up":
                return {
                    "status": "up",
                    "critical": False,
                    "note": "ELVIS ready (Ollama accessible)"
                }
            else:
                return {
                    "status": "degraded",
                    "critical": False,
                    "error": "ELVIS dependency (Ollama) unavailable"
                }
                
        except Exception as e:
            return {
                "status": "unknown",
                "critical": False,
                "error": str(e)
            }
    
    def _check_contemplation(self) -> Dict[str, Any]:
        """Check contemplation loop service"""
        try:
            # Check if contemplation process is running
            result = subprocess.run([
                "pgrep", "-f", "contemplation"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                pids = result.stdout.strip().split('\n')
                return {
                    "status": "up",
                    "critical": False,
                    "process_count": len([pid for pid in pids if pid]),
                    "pids": pids[:3]  # First 3 PIDs
                }
            else:
                return {
                    "status": "down",
                    "critical": False,
                    "error": "No contemplation processes found"
                }
                
        except Exception as e:
            return {
                "status": "unknown",
                "critical": False,
                "error": str(e)
            }
    
    def _check_tools_registry(self) -> Dict[str, Any]:
        """Check tools registry functionality"""
        try:
            # Tools registry is MCP-based, so do a simple file check
            import os
            registry_path = "/Users/bard/Code/mcp-tools-registry"
            
            if os.path.exists(registry_path):
                return {
                    "status": "up",
                    "critical": False,
                    "note": "Registry files accessible"
                }
            else:
                return {
                    "status": "down",
                    "critical": False,
                    "error": "Registry directory not found"
                }
                
        except Exception as e:
            return {
                "status": "unknown",
                "critical": False,
                "error": str(e)
            }

def main():
    """Run service health checks and display results"""
    checker = ServiceHealthChecker()
    results = checker.check_all_services()
    
    print(f"\n🏥 Service Health Check Results - {results['timestamp']}")
    print(f"🎯 Overall Status: {results['overall_status'].upper()}")
    print("-" * 60)
    
    for service_name, service_result in results["services"].items():
        status = service_result["status"]
        critical = service_result.get("critical", False)
        
        status_emoji = {
            "up": "✅",
            "down": "❌", 
            "degraded": "⚠️",
            "unknown": "❓"
        }.get(status, "❓")
        
        critical_marker = " [CRITICAL]" if critical else ""
        
        print(f"{status_emoji} {service_name.replace('_', ' ').title()}: {status.upper()}{critical_marker}")
        
        if service_result.get("error"):
            print(f"   Error: {service_result['error']}")
        elif service_result.get("models_count"):
            print(f"   Models: {service_result['models_count']} available")
        elif service_result.get("db_size_mb"):
            print(f"   Database: {service_result['db_size_mb']} MB")
        elif service_result.get("process_count"):
            print(f"   Processes: {service_result['process_count']} running")
    
    print("-" * 60)
    
    return 0 if results['overall_status'] == 'healthy' else 1

if __name__ == "__main__":
    sys.exit(main())
