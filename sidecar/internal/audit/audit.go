package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Event struct {
	Time   string `json:"time"`
	Action string `json:"action"`
	Target string `json:"target,omitempty"`
	Detail string `json:"detail,omitempty"`
	OK     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
}

type Logger struct {
	mu   sync.Mutex
	path string
}

func DefaultPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".deckhand", "audit.jsonl")
}

func New(path string) *Logger {
	if path == "" {
		path = DefaultPath()
	}
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	return &Logger{path: path}
}

func (l *Logger) Path() string { return l.path }

func (l *Logger) Log(action, target, detail string, err error) {
	if l == nil {
		return
	}
	ev := Event{
		Time:   time.Now().UTC().Format(time.RFC3339),
		Action: action,
		Target: target,
		Detail: detail,
		OK:     err == nil,
	}
	if err != nil {
		ev.Error = err.Error()
	}
	b, _ := json.Marshal(ev)
	l.mu.Lock()
	defer l.mu.Unlock()
	f, openErr := os.OpenFile(l.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if openErr != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(b, '\n'))
}

func (l *Logger) Tail(n int) ([]Event, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, err := os.ReadFile(l.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	lines := splitLines(string(b))
	if n <= 0 || n > len(lines) {
		n = len(lines)
	}
	start := len(lines) - n
	out := make([]Event, 0, n)
	for _, line := range lines[start:] {
		if line == "" {
			continue
		}
		var ev Event
		if json.Unmarshal([]byte(line), &ev) == nil {
			out = append(out, ev)
		}
	}
	return out, nil
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
