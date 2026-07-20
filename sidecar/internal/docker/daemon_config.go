package docker

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func daemonJSONPath() string {
	if p := os.Getenv("DOCKER_DAEMON_JSON"); p != "" {
		return p
	}
	// Common locations — prefer user-level if present
	home, _ := os.UserHomeDir()
	candidates := []string{
		filepath.Join(home, ".docker", "daemon.json"),
		"/etc/docker/daemon.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return filepath.Join(home, ".docker", "daemon.json")
}

// ReadDaemonJSON returns raw daemon.json content and path.
func ReadDaemonJSON() (path string, raw json.RawMessage, err error) {
	path = daemonJSONPath()
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return path, json.RawMessage(`{}`), nil
		}
		return path, nil, err
	}
	if !json.Valid(b) {
		return path, nil, fmt.Errorf("daemon.json is not valid JSON")
	}
	return path, json.RawMessage(b), nil
}

// WriteDaemonJSON writes validated JSON to daemon.json path.
func WriteDaemonJSON(raw json.RawMessage) (string, error) {
	if !json.Valid(raw) {
		return "", fmt.Errorf("invalid JSON")
	}
	path := daemonJSONPath()
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	var pretty any
	if err := json.Unmarshal(raw, &pretty); err != nil {
		return "", err
	}
	out, err := json.MarshalIndent(pretty, "", "  ")
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, append(out, '\n'), 0o644)
}
