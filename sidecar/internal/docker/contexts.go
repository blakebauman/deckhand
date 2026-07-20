package docker

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ContextInfo describes a Docker CLI context.
type ContextInfo struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	DockerHost  string `json:"dockerHost,omitempty"`
	Current     bool   `json:"current"`
}

type dockerConfigFile struct {
	CurrentContext string `json:"currentContext"`
}

type contextMetaFile struct {
	Name      string         `json:"Name"`
	Metadata  map[string]any `json:"Metadata"`
	Endpoints map[string]struct {
		Host          string `json:"Host"`
		SkipTLSVerify bool   `json:"SkipTLSVerify"`
	} `json:"Endpoints"`
}

func dockerConfigDir() string {
	if d := os.Getenv("DOCKER_CONFIG"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".docker")
}

// ListContexts reads Docker CLI contexts from disk.
func ListContexts() ([]ContextInfo, error) {
	cfgDir := dockerConfigDir()
	current := ""
	if b, err := os.ReadFile(filepath.Join(cfgDir, "config.json")); err == nil {
		var cfg dockerConfigFile
		if json.Unmarshal(b, &cfg) == nil {
			current = cfg.CurrentContext
		}
	}
	if current == "" {
		current = "default"
	}

	out := []ContextInfo{{
		Name:        "default",
		DockerHost:  os.Getenv("DOCKER_HOST"),
		Current:     current == "default",
		Description: "Default (DOCKER_HOST / local socket)",
	}}

	metaRoot := filepath.Join(cfgDir, "contexts", "meta")
	entries, err := os.ReadDir(metaRoot)
	if err != nil {
		return out, nil
	}
	seen := map[string]bool{"default": true}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(metaRoot, e.Name(), "meta.json"))
		if err != nil {
			continue
		}
		var meta contextMetaFile
		if json.Unmarshal(raw, &meta) != nil || meta.Name == "" || seen[meta.Name] {
			continue
		}
		seen[meta.Name] = true
		host := ""
		if ep, ok := meta.Endpoints["docker"]; ok {
			host = ep.Host
		}
		desc := ""
		if meta.Metadata != nil {
			if d, ok := meta.Metadata["Description"].(string); ok {
				desc = d
			}
		}
		out = append(out, ContextInfo{
			Name:        meta.Name,
			Description: desc,
			DockerHost:  host,
			Current:     meta.Name == current,
		})
	}
	return out, nil
}

// ResolveContextHost returns the Docker host URL for a named context.
func ResolveContextHost(name string) (string, error) {
	if name == "" || name == "default" {
		return os.Getenv("DOCKER_HOST"), nil
	}
	list, err := ListContexts()
	if err != nil {
		return "", err
	}
	for _, c := range list {
		if c.Name == name {
			return c.DockerHost, nil
		}
	}
	return "", fmt.Errorf("docker context %q not found", name)
}

// WriteCurrentContext updates ~/.docker/config.json currentContext.
func WriteCurrentContext(name string) error {
	cfgPath := filepath.Join(dockerConfigDir(), "config.json")
	var raw map[string]any
	b, err := os.ReadFile(cfgPath)
	if err != nil {
		if os.IsNotExist(err) {
			raw = map[string]any{}
		} else {
			return err
		}
	} else if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	if name == "default" {
		delete(raw, "currentContext")
	} else {
		raw["currentContext"] = name
	}
	out, err := json.MarshalIndent(raw, "", "\t")
	if err != nil {
		return err
	}
	return os.WriteFile(cfgPath, append(out, '\n'), 0o644)
}

// UseContext reconnects the client to the named Docker context and persists currentContext.
func (c *Client) UseContext(name string) error {
	host, err := ResolveContextHost(name)
	if err != nil {
		return err
	}
	if err := c.ReconnectWithHost(host); err != nil {
		return err
	}
	c.SetActiveContext(name)
	_ = WriteCurrentContext(name)
	return nil
}
