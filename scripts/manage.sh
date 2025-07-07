#!/bin/bash
# Brain Monitor Service Manager

case "$1" in
    start)
        echo "Starting Brain monitoring services..."
        launchctl load ~/Library/LaunchAgents/com.mikeybee.brain.execution-api.plist 2>/dev/null
        launchctl load ~/Library/LaunchAgents/com.mikeybee.brain.monitor.plist 2>/dev/null
        sleep 2
        
        if lsof -i :9998 >/dev/null 2>&1 && lsof -i :9996 >/dev/null 2>&1; then
            echo "✅ Services started successfully"
            echo "📊 Monitor: http://localhost:9996/execution-monitor.html"
        else
            echo "❌ Failed to start services"
            echo "Check logs:"
            echo "  - /tmp/brain-api.error.log"
            echo "  - /tmp/brain-monitor.error.log"
        fi
        ;;
        
    stop)
        echo "Stopping Brain monitoring services..."
        launchctl unload ~/Library/LaunchAgents/com.mikeybee.brain.execution-api.plist 2>/dev/null
        launchctl unload ~/Library/LaunchAgents/com.mikeybee.brain.monitor.plist 2>/dev/null
        
        # Kill any remaining processes
        lsof -ti :9996 | xargs kill -9 2>/dev/null
        lsof -ti :9998 | xargs kill -9 2>/dev/null
        echo "✅ Services stopped"
        ;;
        
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
        
    status)
        echo "Brain Monitoring Services Status:"
        echo "================================"
        
        if lsof -i :9998 >/dev/null 2>&1; then
            echo "✅ API Server: Running on port 9998"
        else
            echo "❌ API Server: Not running"
        fi
        
        if lsof -i :9996 >/dev/null 2>&1; then
            echo "✅ Web Monitor: Running on port 9996"
            echo "   URL: http://localhost:9996/execution-monitor.html"
        else
            echo "❌ Web Monitor: Not running"
        fi
        
        echo ""
        echo "LaunchAgent status:"
        launchctl list | grep mikeybee || echo "No services found in launchctl"
        ;;
        
    logs)
        echo "=== API Error Log ==="
        tail -20 /tmp/brain-api.error.log 2>/dev/null || echo "No API errors"
        echo ""
        echo "=== Monitor Error Log ==="
        tail -20 /tmp/brain-monitor.error.log 2>/dev/null || echo "No monitor errors"
        ;;
        
    clean)
        echo "Cleaning up hanging Python processes..."
        # Kill any hanging brain_execute processes
        ps aux | grep 'python3 -c' | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
        echo "✅ Cleaned up"
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|clean}"
        echo ""
        echo "Commands:"
        echo "  start   - Start both monitoring services"
        echo "  stop    - Stop both monitoring services"
        echo "  restart - Restart both services"
        echo "  status  - Check service status"
        echo "  logs    - Show recent error logs"
        echo "  clean   - Clean up hanging Python processes"
        exit 1
        ;;
esac
