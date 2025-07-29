#!/usr/bin/env python3
"""
Context Usage Monitor - Shows conversation token usage in macOS menu bar
"""

import rumps
import json
import time
import os
from datetime import datetime
from pathlib import Path

class ContextMonitor(rumps.App):
    def __init__(self):
        super(ContextMonitor, self).__init__("🧠 --")
        
        # Token limits (Claude's context windows)
        self.MODEL_LIMITS = {
            "claude-3-opus": 200_000,
            "claude-3-sonnet": 200_000,
            "claude-2.1": 200_000,
            "default": 200_000
        }
        
        self.current_model = "default"
        self.max_tokens = self.MODEL_LIMITS[self.current_model]
        self.warning_threshold = 0.80  # 80%
        self.critical_threshold = 0.90  # 90%
        
        # State file
        self.state_file = Path.home() / ".context-monitor" / "state.json"
        self.state_file.parent.mkdir(exist_ok=True)
        
        # Menu items
        self.menu = [
            rumps.MenuItem("Token Usage", callback=self.show_details),
            rumps.MenuItem("Reset Count", callback=self.reset_count),
            rumps.MenuItem("Write Summary", callback=self.request_summary),
            rumps.separator,
            rumps.MenuItem("Settings", callback=self.show_settings),
        ]
        
        # Load state
        self.load_state()
        
        # Start monitoring
        self.update_timer = rumps.Timer(self.update_display, 5)  # Update every 5 seconds
        self.update_timer.start()
        
    def load_state(self):
        """Load token count from state file"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                    self.token_count = state.get('token_count', 0)
                    self.conversation_start = state.get('start_time', time.time())
            else:
                self.reset_state()
        except:
            self.reset_state()
    
    def save_state(self):
        """Save current state"""
        state = {
            'token_count': self.token_count,
            'start_time': self.conversation_start,
            'last_update': time.time()
        }
        with open(self.state_file, 'w') as f:
            json.dump(state, f)
    
    def reset_state(self):
        """Reset token count"""
        self.token_count = 0
        self.conversation_start = time.time()
        self.save_state()
    
    def update_token_count(self, tokens):
        """Update token count (called by external script)"""
        self.token_count = tokens
        self.save_state()
        self.update_display(None)
    
    def update_display(self, _):
        """Update menu bar display"""
        percentage = (self.token_count / self.max_tokens) * 100
        
        # Choose icon based on usage
        if percentage < 50:
            icon = "🟢"
        elif percentage < self.warning_threshold * 100:
            icon = "🟡"
        elif percentage < self.critical_threshold * 100:
            icon = "🟠"
        else:
            icon = "🔴"
        
        # Format display
        self.title = f"{icon} {percentage:.0f}%"
        
        # Add notification for high usage
        if percentage > self.critical_threshold * 100 and not hasattr(self, '_notified_critical'):
            self._notified_critical = True
            rumps.notification(
                "Context Usage Critical",
                "Conversation approaching token limit",
                f"Consider writing a summary. Usage: {percentage:.0f}%"
            )
    
    @rumps.clicked("Token Usage")
    def show_details(self, _):
        """Show detailed token usage"""
        percentage = (self.token_count / self.max_tokens) * 100
        remaining = self.max_tokens - self.token_count
        
        duration = time.time() - self.conversation_start
        hours = duration / 3600
        
        message = f"""Current Usage: {self.token_count:,} / {self.max_tokens:,} tokens
Percentage: {percentage:.1f}%
Remaining: {remaining:,} tokens

Conversation Duration: {hours:.1f} hours
Average Rate: {(self.token_count / max(duration, 1)):.0f} tokens/second"""
        
        rumps.alert("Token Usage Details", message)
    
    @rumps.clicked("Reset Count")
    def reset_count(self, _):
        """Reset token counter"""
        response = rumps.alert(
            "Reset Token Count?",
            "This will reset the token counter to 0. Use this when starting a new conversation.",
            ok="Reset",
            cancel="Cancel"
        )
        if response == 1:  # OK clicked
            self.reset_state()
            self._notified_critical = False
            rumps.notification("Token Counter Reset", "", "Starting fresh count")
    
    @rumps.clicked("Write Summary")
    def request_summary(self, _):
        """Request Claude to write a summary"""
        # Write a flag file that Claude can detect
        flag_file = Path.home() / ".context-monitor" / "summary_requested"
        flag_file.touch()
        rumps.notification(
            "Summary Requested",
            "Please write a summary of our conversation",
            "A flag has been set for the assistant"
        )
    
    @rumps.clicked("Settings")
    def show_settings(self, _):
        """Show settings dialog"""
        window = rumps.Window(
            title="Warning Threshold %",
            message="Enter percentage for warning (0-100):",
            default_text=str(int(self.warning_threshold * 100)),
            ok="Save",
            cancel="Cancel",
            dimensions=(200, 20)
        )
        response = window.run()
        if response.clicked == 1:  # OK
            try:
                threshold = int(response.text) / 100
                if 0 < threshold < 1:
                    self.warning_threshold = threshold
                    rumps.notification("Settings Updated", "", f"Warning at {int(threshold*100)}%")
            except:
                pass

if __name__ == "__main__":
    # Check if we're updating token count
    import sys
    if len(sys.argv) > 1:
        # Update mode: python context_monitor.py <token_count>
        try:
            tokens = int(sys.argv[1])
            state_file = Path.home() / ".context-monitor" / "state.json"
            state = {}
            if state_file.exists():
                with open(state_file, 'r') as f:
                    state = json.load(f)
            state['token_count'] = tokens
            state['last_update'] = time.time()
            state_file.parent.mkdir(exist_ok=True)
            with open(state_file, 'w') as f:
                json.dump(state, f)
            print(f"Updated token count to {tokens}")
        except Exception as e:
            print(f"Error updating token count: {e}")
    else:
        # Normal mode: run the app
        app = ContextMonitor()
        app.run()
