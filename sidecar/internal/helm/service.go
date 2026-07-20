package helm

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Service shells out to the helm CLI against the current kubeconfig.
type Service struct{}

func New() *Service { return &Service{} }

type ReleaseSummary struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Revision   string `json:"revision"`
	Status     string `json:"status"`
	Chart      string `json:"chart"`
	AppVersion string `json:"appVersion"`
	Updated    string `json:"updated"`
}

type InstallRequest struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Chart        string `json:"chart"`
	Version      string `json:"version"`
	ValuesYAML   string `json:"valuesYaml"`
	CreateNS     bool   `json:"createNamespace"`
}

func (s *Service) List(ctx context.Context, ns string, allNamespaces bool) ([]ReleaseSummary, error) {
	args := []string{"list", "-o", "json"}
	if allNamespaces {
		args = append(args, "-A")
	} else if ns != "" {
		args = append(args, "-n", ns)
	}
	out, err := runHelm(ctx, args...)
	if err != nil {
		return nil, err
	}
	var raw []map[string]any
	if err := json.Unmarshal([]byte(out), &raw); err != nil {
		return nil, err
	}
	result := make([]ReleaseSummary, 0, len(raw))
	for _, item := range raw {
		result = append(result, ReleaseSummary{
			Name:       str(item["name"]),
			Namespace:  str(item["namespace"]),
			Revision:   fmt.Sprint(item["revision"]),
			Status:     str(item["status"]),
			Chart:      str(item["chart"]),
			AppVersion: str(item["app_version"]),
			Updated:    str(item["updated"]),
		})
	}
	return result, nil
}

func (s *Service) Get(ctx context.Context, ns, name string) (map[string]any, error) {
	args := []string{"status", name, "-o", "json"}
	if ns != "" {
		args = append(args, "-n", ns)
	}
	out, err := runHelm(ctx, args...)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(out), &m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Install(ctx context.Context, req InstallRequest) (string, error) {
	if req.Name == "" || req.Chart == "" {
		return "", fmt.Errorf("name and chart are required")
	}
	args := []string{"install", req.Name, req.Chart}
	if req.Namespace != "" {
		args = append(args, "-n", req.Namespace)
	}
	if req.CreateNS {
		args = append(args, "--create-namespace")
	}
	if req.Version != "" {
		args = append(args, "--version", req.Version)
	}
	cleanup, err := maybeValuesFile(req.ValuesYAML, &args)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	return runHelm(ctx, args...)
}

func (s *Service) Upgrade(ctx context.Context, req InstallRequest) (string, error) {
	if req.Name == "" || req.Chart == "" {
		return "", fmt.Errorf("name and chart are required")
	}
	args := []string{"upgrade", req.Name, req.Chart}
	if req.Namespace != "" {
		args = append(args, "-n", req.Namespace)
	}
	if req.Version != "" {
		args = append(args, "--version", req.Version)
	}
	cleanup, err := maybeValuesFile(req.ValuesYAML, &args)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	return runHelm(ctx, args...)
}

func (s *Service) Rollback(ctx context.Context, ns, name string, revision int) (string, error) {
	args := []string{"rollback", name}
	if revision > 0 {
		args = append(args, fmt.Sprintf("%d", revision))
	}
	if ns != "" {
		args = append(args, "-n", ns)
	}
	return runHelm(ctx, args...)
}

func (s *Service) Uninstall(ctx context.Context, ns, name string) (string, error) {
	args := []string{"uninstall", name}
	if ns != "" {
		args = append(args, "-n", ns)
	}
	return runHelm(ctx, args...)
}

func maybeValuesFile(yaml string, args *[]string) (func(), error) {
	if strings.TrimSpace(yaml) == "" {
		return nil, nil
	}
	f, err := os.CreateTemp("", "deckhand-values-*.yaml")
	if err != nil {
		return nil, err
	}
	if _, err := f.WriteString(yaml); err != nil {
		_ = f.Close()
		_ = os.Remove(f.Name())
		return nil, err
	}
	_ = f.Close()
	*args = append(*args, "-f", f.Name())
	return func() { _ = os.Remove(f.Name()) }, nil
}

func runHelm(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "helm", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("%w: %s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func str(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}
