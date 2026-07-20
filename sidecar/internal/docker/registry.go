package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"
)

// HubSearchResult is a Docker Hub search hit.
type HubSearchResult struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Stars       int    `json:"starCount"`
	Official    bool   `json:"isOfficial"`
	Automated   bool   `json:"isAutomated"`
	PullCount   int    `json:"pullCount,omitempty"`
}

// SearchHub queries Docker Hub's v1 search API (no auth required for public search).
func SearchHub(ctx context.Context, query string, limit int) ([]HubSearchResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, fmt.Errorf("query required")
	}
	if limit <= 0 || limit > 50 {
		limit = 25
	}
	u := fmt.Sprintf("https://index.docker.io/v1/search?q=%s&n=%d", url.QueryEscape(query), limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("hub search: HTTP %d", res.StatusCode)
	}
	var payload struct {
		Results []HubSearchResult `json:"results"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload.Results, nil
}

// RegistryLogin runs docker login (password via stdin).
func RegistryLogin(ctx context.Context, server, username, password string) error {
	server = strings.TrimSpace(server)
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return fmt.Errorf("username and password required")
	}
	args := []string{"login", "--username", username, "--password-stdin"}
	if server != "" {
		args = append(args, server)
	}
	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Stdin = strings.NewReader(password)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}
