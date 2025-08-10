#!/usr/bin/env python3
"""
Background Vault Analysis System
Continuous, intelligent vault organization using Ollama
"""

from pathlib import Path
import json
import time
import threading
import hashlib
import sqlite3
import subprocess
import logging
import signal
import sys
from queue import PriorityQueue
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import re
import argparse

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class AnalysisResult:
    file_path: str
    primary_topic: str
    content_type: str
    key_concepts: List[str]
    temporal_markers: List[str]
    project_references: List[str]
    relationship_hints: List[str]
    confidence: float
    analyzed_at: float

@dataclass
class Connection:
    source_file: str
    target_file: str
    connection_type: str
    strength_score: float
    confidence: float
    reason: str
    suggested_link: Optional[str] = None
    auto_applied: bool = False
    created_at: float = None

class OllamaClient:
    """Handles communication with Ollama for analysis"""
    
    def __init__(self, model="llama3.2"):
        self.model = model
    
    def call_ollama(self, prompt, timeout=60):
        """Call Ollama via subprocess with error handling"""
        try:
            cmd = ["ollama", "run", self.model]
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            stdout, stderr = process.communicate(input=prompt, timeout=timeout)
            
            if process.returncode == 0:
                return stdout.strip()
            else:
                logger.error(f"Ollama error: {stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            process.kill()
            logger.error("Ollama call timed out")
            return None
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            return None
    
    def extract_json_from_response(self, response):
        """Extract JSON from Ollama response"""
        if not response:
            return None
            
        try:
            # Try to parse the entire response as JSON
            return json.loads(response)
        except json.JSONDecodeError:
            # Look for JSON block in the response
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            matches = re.findall(json_pattern, response, re.DOTALL)
            
            for match in matches:
                try:
                    return json.loads(match)
                except json.JSONDecodeError:
                    continue
            
            logger.warning(f"Could not extract JSON from response: {response[:200]}...")
            return None
    
    def analyze_file_content(self, file_path: Path) -> Optional[AnalysisResult]:
        """Analyze file content and return structured result"""
        try:
            content = file_path.read_text(encoding='utf-8')
            title = file_path.stem
            
            # Limit content for Ollama processing
            content_sample = content[:2000] if len(content) > 2000 else content
            
            prompt = f"""Analyze this note and provide categorization in JSON format.

Title: {title}
Content: {content_sample}

Provide ONLY a JSON response with these fields:
{{
  "primary_topic": "main subject of the note",
  "content_type": "template|project|session|technical|personal|protocol|reference|brain_memory",
  "key_concepts": ["concept1", "concept2", "concept3"],
  "temporal_markers": ["any dates, sessions, versions found"],
  "project_references": ["any project or system names"],
  "relationship_hints": ["types of notes this might connect to"],
  "confidence": 0.85
}}

Respond with valid JSON only, no other text."""

            response = self.call_ollama(prompt)
            result_data = self.extract_json_from_response(response)
            
            if result_data:
                return AnalysisResult(
                    file_path=str(file_path),
                    primary_topic=result_data.get('primary_topic', 'Unknown'),
                    content_type=result_data.get('content_type', 'unknown'),
                    key_concepts=result_data.get('key_concepts', []),
                    temporal_markers=result_data.get('temporal_markers', []),
                    project_references=result_data.get('project_references', []),
                    relationship_hints=result_data.get('relationship_hints', []),
                    confidence=result_data.get('confidence', 0.5),
                    analyzed_at=time.time()
                )
            else:
                logger.warning(f"Failed to analyze {title}")
                return None
                
        except Exception as e:
            logger.error(f"Error analyzing {file_path}: {e}")
            return None
    
    def analyze_connection(self, analysis_a: AnalysisResult, analysis_b: AnalysisResult) -> Optional[Connection]:
        """Analyze potential connection between two files"""
        try:
            prompt = f"""Compare these two notes and determine their connection strength.

Note A:
- File: {Path(analysis_a.file_path).name}
- Topic: {analysis_a.primary_topic}
- Type: {analysis_a.content_type}
- Concepts: {analysis_a.key_concepts}

Note B:
- File: {Path(analysis_b.file_path).name}
- Topic: {analysis_b.primary_topic}
- Type: {analysis_b.content_type}
- Concepts: {analysis_b.key_concepts}

Provide ONLY a JSON response:
{{
  "connection_score": 0-10,
  "connection_type": "thematic|temporal|project|technical|personal|reference|none",
  "reason": "brief explanation of connection or why no connection",
  "confidence": 0.75,
  "suggested_link": "if score > 4, suggest brief link text"
}}

Respond with valid JSON only, no other text."""

            response = self.call_ollama(prompt)
            result_data = self.extract_json_from_response(response)
            
            if result_data and result_data.get('connection_score', 0) > 2:
                return Connection(
                    source_file=analysis_a.file_path,
                    target_file=analysis_b.file_path,
                    connection_type=result_data.get('connection_type', 'thematic'),
                    strength_score=result_data.get('connection_score', 0),
                    confidence=result_data.get('confidence', 0.5),
                    reason=result_data.get('reason', 'No reason provided'),
                    suggested_link=result_data.get('suggested_link'),
                    created_at=time.time()
                )
            
            return None
                
        except Exception as e:
            logger.error(f"Error analyzing connection: {e}")
            return None

class DatabaseManager:
    """Manages SQLite database for analysis results and connections"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript('''
                CREATE TABLE IF NOT EXISTS file_analysis (
                    file_path TEXT PRIMARY KEY,
                    content_hash TEXT,
                    primary_topic TEXT,
                    content_type TEXT,
                    key_concepts TEXT,
                    temporal_markers TEXT,
                    project_references TEXT,
                    relationship_hints TEXT,
                    confidence REAL,
                    analyzed_at REAL
                );
                
                CREATE TABLE IF NOT EXISTS connections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_file TEXT,
                    target_file TEXT,
                    connection_type TEXT,
                    strength_score REAL,
                    confidence REAL,
                    reason TEXT,
                    suggested_link TEXT,
                    auto_applied BOOLEAN DEFAULT FALSE,
                    created_at REAL,
                    applied_at REAL
                );
                
                CREATE TABLE IF NOT EXISTS processing_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT,
                    action TEXT,
                    status TEXT,
                    timestamp REAL,
                    details TEXT
                );
            ''')
    
    def save_analysis(self, analysis: AnalysisResult, content_hash: str):
        """Save analysis result to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO file_analysis 
                (file_path, content_hash, primary_topic, content_type, key_concepts,
                 temporal_markers, project_references, relationship_hints, confidence, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                analysis.file_path, content_hash, analysis.primary_topic, analysis.content_type,
                json.dumps(analysis.key_concepts), json.dumps(analysis.temporal_markers),
                json.dumps(analysis.project_references), json.dumps(analysis.relationship_hints),
                analysis.confidence, analysis.analyzed_at
            ))
    
    def save_connection(self, connection: Connection):
        """Save connection to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO connections 
                (source_file, target_file, connection_type, strength_score, confidence,
                 reason, suggested_link, auto_applied, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                connection.source_file, connection.target_file, connection.connection_type,
                connection.strength_score, connection.confidence, connection.reason,
                connection.suggested_link, connection.auto_applied, connection.created_at
            ))
    
    def get_analysis(self, file_path: str) -> Optional[AnalysisResult]:
        """Get analysis result from database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('SELECT * FROM file_analysis WHERE file_path = ?', (file_path,))
            row = cursor.fetchone()
            
            if row:
                return AnalysisResult(
                    file_path=row[0],
                    primary_topic=row[2],
                    content_type=row[3],
                    key_concepts=json.loads(row[4]),
                    temporal_markers=json.loads(row[5]),
                    project_references=json.loads(row[6]),
                    relationship_hints=json.loads(row[7]),
                    confidence=row[8],
                    analyzed_at=row[9]
                )
        return None
    
    def get_all_analyses(self) -> List[AnalysisResult]:
        """Get all analysis results"""
        analyses = []
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('SELECT * FROM file_analysis ORDER BY analyzed_at DESC')
            for row in cursor.fetchall():
                analyses.append(AnalysisResult(
                    file_path=row[0],
                    primary_topic=row[2],
                    content_type=row[3],
                    key_concepts=json.loads(row[4]),
                    temporal_markers=json.loads(row[5]),
                    project_references=json.loads(row[6]),
                    relationship_hints=json.loads(row[7]),
                    confidence=row[8],
                    analyzed_at=row[9]
                ))
        return analyses
    
    def get_pending_connections(self, min_score=6, min_confidence=0.7) -> List[Connection]:
        """Get high-quality connections not yet applied"""
        connections = []
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                SELECT * FROM connections 
                WHERE auto_applied = FALSE 
                AND strength_score >= ? 
                AND confidence >= ?
                ORDER BY strength_score DESC, confidence DESC
            ''', (min_score, min_confidence))
            
            for row in cursor.fetchall():
                connections.append(Connection(
                    source_file=row[1],
                    target_file=row[2],
                    connection_type=row[3],
                    strength_score=row[4],
                    confidence=row[5],
                    reason=row[6],
                    suggested_link=row[7],
                    auto_applied=bool(row[8]),
                    created_at=row[9]
                ))
        return connections

class BackgroundVaultAnalyzer:
    """Main background service for continuous vault analysis and organization"""
    
    def __init__(self, vault_path: str, config: Dict = None):
        self.vault_path = Path(vault_path)
        self.config = config or self.default_config()
        
        # Initialize components
        db_path = self.vault_path.parent / "vault_analysis.db"
        self.db = DatabaseManager(str(db_path))
        self.ollama = OllamaClient(self.config["processing"]["ollama_model"])
        
        # Task management
        self.task_queue = PriorityQueue()
        self.file_hashes = {}
        self.processing_stats = {
            "files_processed": 0,
            "connections_found": 0,
            "connections_applied": 0,
            "errors": 0,
            "start_time": time.time(),
            "last_activity": time.time()
        }
        
        # State management
        self.running = False
        self.threads = []
        self.last_scan = 0
        self.connection_application_count = 0
        self.last_connection_hour = 0
        
        logger.info(f"BackgroundVaultAnalyzer initialized for {self.vault_path}")
    
    def default_config(self):
        """Default configuration for the analyzer"""
        return {
            "processing": {
                "ollama_model": "llama3.2",
                "max_concurrent_tasks": 2,
                "rate_limit_per_minute": 10,
                "analysis_timeout": 90
            },
            "auto_apply": {
                "enabled": True,
                "confidence_threshold": 0.75,
                "strength_threshold": 7.0,
                "max_per_hour": 15,
                "safe_connection_types": ["temporal", "project", "thematic"]
            },
            "monitoring": {
                "scan_interval_seconds": 45,
                "full_analysis_interval_hours": 24,
                "cleanup_interval_hours": 168  # Weekly
            },
            "safety": {
                "max_file_size_mb": 5,
                "skip_patterns": [".git", ".obsidian", "temp", ".temp", "__pycache__"],
                "backup_before_modify": True
            }
        }
    
    def start_service(self):
        """Start the background analysis service"""
        if self.running:
            logger.warning("Service already running")
            return False
        
        logger.info("Starting Background Vault Analysis Service...")
        logger.info(f"Vault: {self.vault_path}")
        
        self.running = True
        self.processing_stats["start_time"] = time.time()
        
        # Start component threads
        try:
            # File monitoring thread
            monitor_thread = threading.Thread(target=self._file_monitor_loop, daemon=True, name="FileMonitor")
            monitor_thread.start()
            self.threads.append(monitor_thread)
            
            # Task processing thread
            processor_thread = threading.Thread(target=self._task_processor_loop, daemon=True, name="TaskProcessor")
            processor_thread.start()
            self.threads.append(processor_thread)
            
            # Connection analysis thread
            connection_thread = threading.Thread(target=self._connection_analyzer_loop, daemon=True, name="ConnectionAnalyzer")
            connection_thread.start()
            self.threads.append(connection_thread)
            
            logger.info("All background threads started successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start service: {e}")
            self.stop_service()
            return False
    
    def _file_monitor_loop(self):
        """Monitor vault files for changes"""
        logger.info("File monitoring started")
        
        while self.running:
            try:
                current_time = time.time()
                
                # Scan for file changes
                if current_time - self.last_scan > self.config["monitoring"]["scan_interval_seconds"]:
                    self._scan_vault_files()
                    self.last_scan = current_time
                
                time.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in file monitor: {e}")
                self.processing_stats["errors"] += 1
                time.sleep(30)  # Wait before retrying
    
    def _scan_vault_files(self):
        """Scan vault for new or modified files"""
        try:
            markdown_files = list(self.vault_path.rglob("*.md"))
            new_files = 0
            modified_files = 0
            
            for file_path in markdown_files:
                if not self._should_process_file(file_path):
                    continue
                
                file_hash = self._get_file_hash(file_path)
                if not file_hash:
                    continue
                
                path_str = str(file_path)
                
                if path_str not in self.file_hashes:
                    # New file
                    self._queue_analysis_task(file_path, priority=1, task_type="new_file")
                    new_files += 1
                    logger.info(f"New file queued: {file_path.name}")
                    
                elif self.file_hashes[path_str] != file_hash:
                    # Modified file
                    self._queue_analysis_task(file_path, priority=2, task_type="modified_file")
                    modified_files += 1
                    logger.info(f"Modified file queued: {file_path.name}")
                
                self.file_hashes[path_str] = file_hash
            
            if new_files > 0 or modified_files > 0:
                logger.info(f"Scan complete: {new_files} new, {modified_files} modified files")
                
        except Exception as e:
            logger.error(f"Error scanning vault files: {e}")
            self.processing_stats["errors"] += 1
    
    def _should_process_file(self, file_path: Path) -> bool:
        """Determine if file should be processed"""
        try:
            # Check file size
            size_mb = file_path.stat().st_size / (1024 * 1024)
            if size_mb > self.config["safety"]["max_file_size_mb"]:
                return False
            
            # Check skip patterns
            path_str = str(file_path).lower()
            for pattern in self.config["safety"]["skip_patterns"]:
                if pattern in path_str:
                    return False
            
            return file_path.suffix.lower() == '.md'
            
        except Exception:
            return False
    
    def _get_file_hash(self, file_path: Path) -> Optional[str]:
        """Get MD5 hash of file content"""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            return hashlib.md5(content.encode()).hexdigest()
        except Exception:
            return None
    
    def _queue_analysis_task(self, file_path: Path, priority: int, task_type: str):
        """Queue file for analysis"""
        task = {
            "file_path": file_path,
            "type": task_type,
            "queued_at": time.time()
        }
        
        # Use negative timestamp for proper priority ordering
        self.task_queue.put((priority, -time.time(), task))
    
    def _task_processor_loop(self):
        """Process queued analysis tasks"""
        logger.info("Task processor started")
        
        while self.running:
            try:
                if not self.task_queue.empty():
                    priority, timestamp, task = self.task_queue.get()
                    
                    logger.info(f"Processing {task['type']}: {task['file_path'].name}")
                    self._process_analysis_task(task)
                    
                    # Rate limiting
                    sleep_time = 60 / self.config["processing"]["rate_limit_per_minute"]
                    time.sleep(sleep_time)
                else:
                    time.sleep(10)  # No tasks, wait
                    
            except Exception as e:
                logger.error(f"Error in task processor: {e}")
                self.processing_stats["errors"] += 1
                time.sleep(30)
    
    def _process_analysis_task(self, task):
        """Process a single file analysis task"""
        file_path = task["file_path"]
        
        try:
            # Perform Ollama analysis
            analysis = self.ollama.analyze_file_content(file_path)
            
            if analysis:
                file_hash = self._get_file_hash(file_path)
                self.db.save_analysis(analysis, file_hash)
                self.processing_stats["files_processed"] += 1
                self.processing_stats["last_activity"] = time.time()
                
                logger.info(f"Analyzed: {file_path.name} -> {analysis.primary_topic}")
            else:
                logger.warning(f"Analysis failed for: {file_path.name}")
                self.processing_stats["errors"] += 1
                
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            self.processing_stats["errors"] += 1
    
    def _connection_analyzer_loop(self):
        """Analyze connections between files"""
        logger.info("Connection analyzer started")
        
        while self.running:
            try:
                # Get all analyses for connection comparison
                all_analyses = self.db.get_all_analyses()
                
                if len(all_analyses) < 2:
                    time.sleep(60)  # Wait for more files to be analyzed
                    continue
                
                # Find potential connections (limit to prevent overwhelming)
                connections_found = 0
                max_connections_per_run = 20
                
                for i, analysis_a in enumerate(all_analyses[:50]):  # Limit scope
                    for analysis_b in all_analyses[i+1:50]:
                        if connections_found >= max_connections_per_run:
                            break
                        
                        connection = self.ollama.analyze_connection(analysis_a, analysis_b)
                        
                        if connection:
                            self.db.save_connection(connection)
                            connections_found += 1
                            self.processing_stats["connections_found"] += 1
                            
                            logger.info(f"Connection found: {Path(connection.source_file).name} -> {Path(connection.target_file).name} (score: {connection.strength_score})")
                            
                            # Auto-apply if criteria met
                            if self._should_auto_apply_connection(connection):
                                if self._apply_connection(connection):
                                    self.processing_stats["connections_applied"] += 1
                                    logger.info(f"Auto-applied connection")
                        
                        # Rate limiting between connection analyses
                        time.sleep(2)
                    
                    if connections_found >= max_connections_per_run:
                        break
                
                # Wait before next connection analysis cycle
                time.sleep(300)  # 5 minutes between cycles
                
            except Exception as e:
                logger.error(f"Error in connection analyzer: {e}")
                self.processing_stats["errors"] += 1
                time.sleep(60)
    
    def _should_auto_apply_connection(self, connection: Connection) -> bool:
        """Determine if connection should be automatically applied"""
        current_hour = int(time.time() / 3600)
        
        # Reset hourly counter
        if current_hour != self.last_connection_hour:
            self.connection_application_count = 0
            self.last_connection_hour = current_hour
        
        # Check rate limits
        if self.connection_application_count >= self.config["auto_apply"]["max_per_hour"]:
            return False
        
        # Check thresholds
        if (connection.confidence < self.config["auto_apply"]["confidence_threshold"] or
            connection.strength_score < self.config["auto_apply"]["strength_threshold"]):
            return False
        
        # Check if connection type is safe for auto-apply
        if connection.connection_type not in self.config["auto_apply"]["safe_connection_types"]:
            return False
        
        return self.config["auto_apply"]["enabled"]
    
    def _apply_connection(self, connection: Connection) -> bool:
        """Apply connection by modifying source file"""
        try:
            source_path = Path(connection.source_file)
            target_path = Path(connection.target_file)
            
            if not source_path.exists() or not target_path.exists():
                logger.warning(f"Cannot apply connection - files missing")
                return False
            
            # Read source file
            content = source_path.read_text(encoding='utf-8')
            
            # Create connection link text
            target_name = target_path.stem
            if connection.suggested_link:
                link_text = f"- [[{target_name}]] - {connection.suggested_link}"
            else:
                link_text = f"- [[{target_name}]]"
            
            # Look for existing connection sections
            if "## Related Notes" in content:
                # Add to existing section
                content = content.replace(
                    "## Related Notes",
                    f"## Related Notes\n{link_text}"
                )
            elif "## See Also" in content:
                # Add to existing section
                content = content.replace(
                    "## See Also", 
                    f"## See Also\n{link_text}"
                )
            else:
                # Add new section at end
                content = content.rstrip() + f"\n\n## Related Notes\n\n{link_text}\n"
            
            # Write modified content
            source_path.write_text(content, encoding='utf-8')
            
            # Update connection record
            connection.auto_applied = True
            self.connection_application_count += 1
            
            return True
            
        except Exception as e:
            logger.error(f"Error applying connection: {e}")
            return False
    
    def get_status(self) -> Dict:
        """Get comprehensive service status"""
        uptime = time.time() - self.processing_stats["start_time"]
        
        return {
            "service": {
                "running": self.running,
                "uptime_hours": uptime / 3600,
                "active_threads": len([t for t in self.threads if t.is_alive()]),
            },
            "processing": {
                "queue_size": self.task_queue.qsize(),
                "files_tracked": len(self.file_hashes),
                "files_processed": self.processing_stats["files_processed"],
                "connections_found": self.processing_stats["connections_found"],
                "connections_applied": self.processing_stats["connections_applied"],
                "errors": self.processing_stats["errors"],
            },
            "rates": {
                "files_per_hour": self.processing_stats["files_processed"] / max(uptime / 3600, 1),
                "connections_per_hour": self.processing_stats["connections_found"] / max(uptime / 3600, 1),
            }
        }
    
    def stop_service(self):
        """Stop the background service"""
        logger.info("Stopping Background Vault Analysis Service...")
        self.running = False
        
        # Wait for threads to finish (with timeout)
        for thread in self.threads:
            thread.join(timeout=10)
        
        logger.info("Service stopped")
    
    def force_analysis(self, file_path: str = None):
        """Force immediate analysis of specific file or all files"""
        if file_path:
            path = Path(file_path)
            if path.exists():
                self._queue_analysis_task(path, priority=0, task_type="forced")
                logger.info(f"Forced analysis queued for: {path.name}")
        else:
            # Force analysis of all files
            for file_path in self.vault_path.rglob("*.md"):
                if self._should_process_file(file_path):
                    self._queue_analysis_task(file_path, priority=0, task_type="forced")
            logger.info("Forced analysis queued for all files")

# Global service instance
analyzer_service = None

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    global analyzer_service
    logger.info(f"Received signal {signum}, shutting down...")
    if analyzer_service:
        analyzer_service.stop_service()
    sys.exit(0)

def main():
    """Main entry point for the service"""
    global analyzer_service
    
    parser = argparse.ArgumentParser(description='Background Vault Analysis Service')
    parser.add_argument('command', choices=['start', 'stop', 'status', 'test', 'force-analysis'], 
                       help='Command to execute')
    parser.add_argument('--vault-path', default='/Users/bard/Code/claude-brain/data/BrainVault',
                       help='Path to vault directory')
    parser.add_argument('--config', help='Path to configuration file')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Set logging level')
    
    args = parser.parse_args()
    
    # Set up logging
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Load configuration
    config = None
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            sys.exit(1)
    
    # Create analyzer instance
    analyzer_service = BackgroundVaultAnalyzer(args.vault_path, config)
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    if args.command == 'start':
        logger.info("Starting Background Vault Analysis Service...")
        
        if analyzer_service.start_service():
            if args.daemon:
                # Run as daemon
                try:
                    while True:
                        time.sleep(60)
                        # Print status every hour
                        status = analyzer_service.get_status()
                        logger.info(f"Status: {status['processing']['files_processed']} files processed, "
                                   f"{status['processing']['connections_found']} connections found")
                except KeyboardInterrupt:
                    pass
            else:
                # Interactive mode
                print("Service started. Commands:")
                print("  status - Show service status")
                print("  stop - Stop service")
                print("  force - Force analysis of all files")
                print("  quit - Quit")
                
                while True:
                    try:
                        cmd = input("\n> ").strip().lower()
                        
                        if cmd == 'status':
                            status = analyzer_service.get_status()
                            print(json.dumps(status, indent=2))
                        
                        elif cmd == 'stop' or cmd == 'quit':
                            break
                        
                        elif cmd == 'force':
                            analyzer_service.force_analysis()
                            print("Forced analysis queued for all files")
                        
                        elif cmd == 'help':
                            print("Commands: status, stop, force, quit, help")
                        
                        else:
                            print("Unknown command. Type 'help' for commands.")
                            
                    except KeyboardInterrupt:
                        break
                    except EOFError:
                        break
        
        analyzer_service.stop_service()
    
    elif args.command == 'status':
        # Just show current status (would need to connect to running service)
        print("Status command would connect to running service")
    
    elif args.command == 'test':
        # Test mode - analyze a few files and exit
        logger.info("Running test analysis...")
        analyzer_service.force_analysis()
        analyzer_service.start_service()
        
        # Let it run for 2 minutes
        time.sleep(120)
        
        status = analyzer_service.get_status()
        print("Test Results:")
        print(json.dumps(status, indent=2))
        
        analyzer_service.stop_service()
    
    elif args.command == 'force-analysis':
        # Force analysis and exit
        logger.info("Forcing analysis of all files...")
        analyzer_service.force_analysis()
        analyzer_service.start_service()
        
        # Wait for queue to empty
        while analyzer_service.task_queue.qsize() > 0:
            time.sleep(10)
            status = analyzer_service.get_status()
            print(f"Queue: {status['processing']['queue_size']}, "
                  f"Processed: {status['processing']['files_processed']}")
        
        analyzer_service.stop_service()
        print("Analysis complete!")

if __name__ == "__main__":
    main()
