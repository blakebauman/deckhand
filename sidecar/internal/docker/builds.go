package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// BuilderInfo describes a buildx builder.
type BuilderInfo struct {
	Name       string `json:"name"`
	Driver     string `json:"driver,omitempty"`
	LastActivity string `json:"lastActivity,omitempty"`
	Status     string `json:"status,omitempty"`
	Nodes      int    `json:"nodes,omitempty"`
}

// BuildHistoryItem is a recent buildx history entry when available.
type BuildHistoryItem struct {
	ID        string `json:"id"`
	Ref       string `json:"ref,omitempty"`
	CreatedAt string `json:"createdAt,omitempty"`
	Status    string `json:"status,omitempty"`
}

// ListBuilders returns docker buildx ls parsed as JSON when possible.
func ListBuilders(ctx context.Context) ([]BuilderInfo, error) {
	out, err := exec.CommandContext(ctx, "docker", "buildx", "ls", "--format", "json").CombinedOutput()
	if err != nil {
		// fallback: default builder only
		if LookPathBuildx() {
			return []BuilderInfo{{Name: "default", Driver: "docker", Status: "running"}}, nil
		}
		return nil, fmt.Errorf("buildx: %s", strings.TrimSpace(string(out)))
	}
	dec := json.NewDecoder(bytes.NewReader(out))
	var list []BuilderInfo
	for dec.More() {
		var raw map[string]any
		if err := dec.Decode(&raw); err != nil {
			break
		}
		name, _ := raw["name"].(string)
		if name == "" {
			name, _ = raw["Name"].(string)
		}
		driver, _ := raw["driver"].(string)
		if driver == "" {
			driver, _ = raw["Driver"].(string)
		}
		status, _ := raw["status"].(string)
		list = append(list, BuilderInfo{Name: name, Driver: driver, Status: status})
	}
	if len(list) == 0 {
		// try line-oriented table parse
		lines := strings.Split(string(out), "\n")
		for i, line := range lines {
			if i == 0 || strings.TrimSpace(line) == "" {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) >= 1 {
				list = append(list, BuilderInfo{Name: strings.TrimSuffix(fields[0], "*"), Driver: at(fields, 1), Status: at(fields, 3)})
			}
		}
	}
	return list, nil
}

func at(fields []string, i int) string {
	if i < len(fields) {
		return fields[i]
	}
	return ""
}

func LookPathBuildx() bool {
	_, err := exec.LookPath("docker")
	return err == nil
}

// BuildImage runs docker build and streams combined output.
func BuildImage(ctx context.Context, contextDir, dockerfile, tag string, onLine func(string)) error {
	if contextDir == "" {
		return fmt.Errorf("context path required")
	}
	args := []string{"build"}
	if dockerfile != "" {
		args = append(args, "-f", dockerfile)
	}
	if tag != "" {
		args = append(args, "-t", tag)
	}
	args = append(args, contextDir)
	cmd := exec.CommandContext(ctx, "docker", args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		return err
	}
	buf := make([]byte, 4096)
	for {
		n, rerr := stdout.Read(buf)
		if n > 0 && onLine != nil {
			onLine(string(buf[:n]))
		}
		if rerr != nil {
			break
		}
	}
	return cmd.Wait()
}
