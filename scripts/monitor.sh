#!/bin/bash
# Brain Monitoring System Manager

case "$1" in
    start|"")
#!/bin/bash
# Start Brain Monitoring System

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITOR_DIR="$SCRIPT_DIR/../monitor"

echo "🚀 Starting Brain Monitoring System..."

# Kill any existing processes
echo "Cleaning up old processes..."
lsof -ti :9996 | xargs kill -9 2>/dev/null
lsof -ti :9998 | xargs kill -9 2>/dev/null
sleep 1

# Start Brain server
echo "Starting Brain server on brain server..."
cd "$MONITOR_DIR"
nohup python3 server.py > /tmp/brain-api.log 2>&1 &
API_PID=$!
echo "API Server PID: $API_PID"

# Start web server
echo "Starting web server on port 9996..."
nohup python3 -m http.server 9996 > /tmp/brain-web.log 2>&1 &
WEB_PID=$!
echo "Web Server PID: $WEB_PID"

# Wait and check
sleep 2

# Verify both are running
if lsof -i :9998 >/dev/null 2>&1 && lsof -i :9996 >/dev/null 2>&1; then
    echo ""
    echo "✅ Brain Monitoring System started successfully!"
    echo ""
    echo "📊 Monitor UI: http://localhost:9996/execution-monitor.html"
    echo "📊 Alternative: http://localhost:9996/ui.html"
    echo "📡 API Endpoint: http://localhost:9998/"
    echo ""
    echo "📝 Logs:"
    echo "   API: /tmp/brain-api.log"
    echo "   Web: /tmp/brain-web.log"
    echo ""
    echo "To stop: $0 stop"
else
    echo "❌ Failed to start monitoring system"
    echo "Check logs in /tmp/brain-*.log"
    exit 1
fi

        ;;
    
    stop)
        echo "Stopping Brain Monitoring System..."
        lsof -ti :9996 | xargs kill -9 2>/dev/null
        lsof -ti :9998 | xargs kill -9 2>/dev/null
        echo "✅ Monitoring system stopped"
        ;;
        
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
        
    status)
        echo "Brain Monitoring Status:"
        echo "======================="
        if lsof -i :9998 >/dev/null 2>&1; then
            echo "✅ API Server: Running (brain server)"
        else
            echo "❌ API Server: Not running"
        fi
        
        if lsof -i :9996 >/dev/null 2>&1; then
            echo "✅ Web Server: Running (port 9996)"
        else
            echo "❌ Web Server: Not running"
        fi
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
