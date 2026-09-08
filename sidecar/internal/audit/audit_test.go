package audit

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func newTestLogger(t *testing.T) *Logger {
	t.Helper()
	return New(filepath.Join(t.TempDir(), "nested", "audit.jsonl"))
}

func TestNewCreatesParentDirectory(t *testing.T) {
	l := newTestLogger(t)
	if _, err := os.Stat(filepath.Dir(l.Path())); err != nil {
		t.Fatalf("parent directory not created: %v", err)
	}
}

func TestLogAndTailRoundTrip(t *testing.T) {
	l := newTestLogger(t)
	l.Log("container.remove", "web", "force=true", nil)
	l.Log("volume.prune", "", "", errors.New("daemon unreachable"))

	events, err := l.Tail(0)
	if err != nil {
		t.Fatalf("Tail: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("Tail returned %d events, want 2", len(events))
	}

	ok := events[0]
	if ok.Action != "container.remove" || ok.Target != "web" || ok.Detail != "force=true" {
		t.Errorf("first event = %+v, want the container.remove fields", ok)
	}
	if !ok.OK || ok.Error != "" {
		t.Errorf("nil error should record OK with no message, got ok=%v error=%q", ok.OK, ok.Error)
	}
	if _, err := time.Parse(time.RFC3339, ok.Time); err != nil {
		t.Errorf("Time %q is not RFC3339: %v", ok.Time, err)
	}

	failed := events[1]
	if failed.OK {
		t.Error("an event logged with an error should not be OK")
	}
	if failed.Error != "daemon unreachable" {
		t.Errorf("Error = %q, want the error's message", failed.Error)
	}
}

func TestTailReturnsTheLastNEvents(t *testing.T) {
	l := newTestLogger(t)
	for _, action := range []string{"a", "b", "c", "d"} {
		l.Log(action, "", "", nil)
	}

	events, err := l.Tail(2)
	if err != nil {
		t.Fatalf("Tail: %v", err)
	}
	if len(events) != 2 || events[0].Action != "c" || events[1].Action != "d" {
		t.Fatalf("Tail(2) = %+v, want the newest two (c, d)", events)
	}

	// A request for more than exists is clamped rather than erroring, so the
	// UI's fixed tail size works against a short log.
	all, err := l.Tail(100)
	if err != nil {
		t.Fatalf("Tail: %v", err)
	}
	if len(all) != 4 {
		t.Errorf("Tail(100) returned %d events, want all 4", len(all))
	}
}

func TestTailOnMissingLogIsNotAnError(t *testing.T) {
	// The audit log does not exist until the first mutating operation, and the
	// UI polls GET /api/audit before then.
	l := &Logger{path: filepath.Join(t.TempDir(), "absent.jsonl")}
	events, err := l.Tail(10)
	if err != nil {
		t.Fatalf("Tail on a missing file: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("Tail on a missing file returned %d events, want none", len(events))
	}
}

func TestTailSkipsUnparseableLines(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit.jsonl")
	// A truncated write (crash mid-append) must not poison the whole tail.
	body := `{"time":"2026-01-01T00:00:00Z","action":"good","ok":true}` + "\n" +
		"{not json" + "\n" +
		"\n" +
		`{"time":"2026-01-01T00:00:01Z","action":"also-good","ok":true}` + "\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}

	events, err := (&Logger{path: path}).Tail(0)
	if err != nil {
		t.Fatalf("Tail: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("Tail returned %d events, want the 2 parseable ones", len(events))
	}
	if events[0].Action != "good" || events[1].Action != "also-good" {
		t.Errorf("Tail = %+v, want the two well-formed events in order", events)
	}
}

func TestLogFileIsOwnerOnly(t *testing.T) {
	// The log records container names, image refs, and host paths; it is
	// created 0600 so other local accounts cannot read it.
	l := newTestLogger(t)
	l.Log("image.pull", "nginx:latest", "", nil)

	st, err := os.Stat(l.Path())
	if err != nil {
		t.Fatal(err)
	}
	if perm := st.Mode().Perm(); perm != 0o600 {
		t.Errorf("audit log mode = %o, want 600", perm)
	}
}

func TestNilLoggerIsANoOp(t *testing.T) {
	// Handlers call s.audit.Log unconditionally, so a nil logger must not panic.
	var l *Logger
	l.Log("container.stop", "web", "", nil)
}
