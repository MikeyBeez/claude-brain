#!/usr/bin/env python3
"""
Start or update the context monitor
Can be called during brain initialization
"""

import subprocess
import sys
import os
import time

def is_monitor_running():
    """Check if context monitor is already running"""
    try:
        result = subprocess.run(['pgrep', '-f', 'context_monitor.py'], 
                              capture_output=True, text=True)
        return result.returncode == 0
    except:
        return False

def start_monitor():
    """Start the context monitor in background"""
    monitor_path = os.path.join(os.path.dirname(__file__), 'context_monitor.py')
    
    if not os.path.exists(monitor_path):
        print(f"Error: Context monitor not found at {monitor_path}")
        return False
    
    try:
        # Start in background, detached from current process
        subprocess.Popen([sys.executable, monitor_path],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True)
        print("Context monitor started")
        return True
    except Exception as e:
        print(f"Error starting context monitor: {e}")
        return False

def update_token_count(count):
    """Update the token count"""
    monitor_path = os.path.join(os.path.dirname(__file__), 'context_monitor.py')
    
    try:
        subprocess.run([sys.executable, monitor_path, str(count)], check=True)
        print(f"Updated token count to {count}")
    except Exception as e:
        print(f"Error updating token count: {e}")

def main():
    if len(sys.argv) > 1:
        # Update token count
        try:
            token_count = int(sys.argv[1])
            update_token_count(token_count)
        except ValueError:
            print("Usage: start_context_monitor.py [token_count]")
            sys.exit(1)
    else:
        # Start monitor if not running
        if is_monitor_running():
            print("Context monitor is already running")
        else:
            if start_monitor():
                # Give it a moment to start
                time.sleep(2)
                # Set initial token count to 0
                update_token_count(0)
            else:
                sys.exit(1)

if __name__ == "__main__":
    main()
