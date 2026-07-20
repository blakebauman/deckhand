package docker

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// DiagnoseReport is a troubleshoot snapshot for Settings.
type DiagnoseReport struct {
	OK            bool              `json:"ok"`
	Time          string            `json:"time"`
	Goos          string            `json:"goos"`
	DockerHost    string            `json:"dockerHost"`
	ActiveContext string            `json:"activeContext"`
	PingError     string            `json:"pingError,omitempty"`
	ServerVersion string            `json:"serverVersion,omitempty"`
	Compose       string            `json:"compose,omitempty"`
	Helm          string            `json:"helm,omitempty"`
	Buildx        string            `json:"buildx,omitempty"`
	ProxyHTTP     string            `json:"proxyHttp,omitempty"`
	ProxyHTTPS    string            `json:"proxyHttps,omitempty"`
	Notes         []string          `json:"notes,omitempty"`
	Extra         map[string]string `json:"extra,omitempty"`
}

func (c *Client) Diagnose(ctx context.Context) DiagnoseReport {
	rep := DiagnoseReport{
		Time:          time.Now().Format(time.RFC3339),
		Goos:          runtime.GOOS,
		DockerHost:    c.ActiveHost(),
		ActiveContext: c.ActiveContext(),
		ProxyHTTP:     firstEnv("HTTP_PROXY", "http_proxy"),
		ProxyHTTPS:    firstEnv("HTTPS_PROXY", "https_proxy"),
		Extra:         map[string]string{},
	}
	if rep.DockerHost == "" {
		rep.DockerHost = os.Getenv("DOCKER_HOST")
	}
	if rep.ActiveContext == "" {
		if list, err := ListContexts(); err == nil {
			for _, cx := range list {
				if cx.Current {
					rep.ActiveContext = cx.Name
					break
				}
			}
		}
	}

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := c.Ping(pingCtx); err != nil {
		rep.PingError = err.Error()
		rep.Notes = append(rep.Notes, "Docker engine unreachable — start any Docker-compatible engine, then reconnect.")
	} else {
		rep.OK = true
		if v, err := c.Version(pingCtx); err == nil {
			rep.ServerVersion = v.Version
			rep.Extra["apiVersion"] = v.APIVersion
			rep.Extra["platform"] = v.Os + "/" + v.Arch
		}
	}

	rep.Compose = toolVersion(ctx, "docker", "compose", "version", "--short")
	if rep.Compose == "" {
		rep.Compose = toolVersion(ctx, "docker-compose", "version", "--short")
	}
	rep.Helm = toolVersion(ctx, "helm", "version", "--short")
	rep.Buildx = toolVersion(ctx, "docker", "buildx", "version")
	return rep
}

func firstEnv(keys ...string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return ""
}

func toolVersion(ctx context.Context, name string, args ...string) string {
	path, err := exec.LookPath(name)
	if err != nil {
		return ""
	}
	cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, path, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return strings.TrimSpace(string(out))
	}
	return strings.TrimSpace(string(out))
}
