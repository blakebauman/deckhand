package compose

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Service shells out to the docker compose CLI for project lifecycle.
type Service struct{}

func New() *Service { return &Service{} }

type Project struct {
	Name        string   `json:"name"`
	Path        string   `json:"path,omitempty"`
	ConfigFiles []string `json:"configFiles,omitempty"`
	Status      string   `json:"status,omitempty"`
	Source      string   `json:"source,omitempty"` // "engine" | "scan"
	Running     bool     `json:"running,omitempty"`
}

type UpRequest struct {
	Path        string   `json:"path"`
	ConfigFiles []string `json:"configFiles"`
	YAML        string   `json:"yaml"`
	ProjectName string   `json:"projectName"`
	Detach      bool     `json:"detach"`
}

type DiscoverRequest struct {
	Roots    []string `json:"roots"`
	MaxDepth int      `json:"maxDepth"`
}

// ServiceInfo is one compose service from `docker compose config --services` / ps.
type ServiceInfo struct {
	Name    string `json:"name"`
	Status  string `json:"status,omitempty"`
	State   string `json:"state,omitempty"`
	Image   string `json:"image,omitempty"`
	Project string `json:"project,omitempty"`
}

type lsRow struct {
	Name        string `json:"Name"`
	Status      string `json:"Status"`
	ConfigFiles string `json:"ConfigFiles"`
}

var composeFileNames = []string{
	"compose.yaml",
	"compose.yml",
	"docker-compose.yml",
	"docker-compose.yaml",
}

func (s *Service) List(ctx context.Context) ([]Project, error) {
	out, err := runDocker(ctx, "", "compose", "ls", "-a", "--format", "json")
	if err != nil {
		return nil, err
	}
	out = strings.TrimSpace(out)
	if out == "" || out == "null" {
		return []Project{}, nil
	}
	var rows []lsRow
	if err := json.Unmarshal([]byte(out), &rows); err != nil {
		// Some docker versions emit NDJSON
		rows = nil
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			var row lsRow
			if e := json.Unmarshal([]byte(line), &row); e != nil {
				return nil, fmt.Errorf("parse compose ls: %w", err)
			}
			rows = append(rows, row)
		}
	}
	projects := make([]Project, 0, len(rows))
	for _, row := range rows {
		files := existingFiles(splitConfigFiles(row.ConfigFiles))
		path := ""
		if len(files) > 0 {
			path = files[0]
		}
		status := strings.TrimSpace(row.Status)
		projects = append(projects, Project{
			Name:        row.Name,
			Path:        path,
			ConfigFiles: files,
			Status:      status,
			Source:      "engine",
			Running:     strings.Contains(strings.ToLower(status), "running"),
		})
	}
	return projects, nil
}

func (s *Service) Discover(ctx context.Context, req DiscoverRequest) ([]Project, error) {
	_ = ctx
	maxDepth := req.MaxDepth
	if maxDepth <= 0 {
		maxDepth = 3
	}
	if maxDepth > 6 {
		maxDepth = 6
	}
	seen := map[string]struct{}{}
	var projects []Project
	for _, root := range req.Roots {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		abs, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		st, err := os.Stat(abs)
		if err != nil || !st.IsDir() {
			continue
		}
		_ = filepath.WalkDir(abs, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			rel, relErr := filepath.Rel(abs, path)
			if relErr != nil {
				return nil
			}
			if d.IsDir() {
				base := d.Name()
				if base == "node_modules" || base == ".git" || base == "vendor" || base == "dist" || base == "target" {
					return filepath.SkipDir
				}
				depth := 0
				if rel != "." {
					depth = strings.Count(rel, string(os.PathSeparator)) + 1
				}
				if depth > maxDepth {
					return filepath.SkipDir
				}
				return nil
			}
			name := d.Name()
			match := false
			for _, candidate := range composeFileNames {
				if name == candidate {
					match = true
					break
				}
			}
			if !match {
				return nil
			}
			dir := filepath.Dir(path)
			key := dir
			if _, ok := seen[key]; ok {
				return nil
			}
			seen[key] = struct{}{}
			projectName := filepath.Base(dir)
			projects = append(projects, Project{
				Name:        projectName,
				Path:        path,
				ConfigFiles: []string{path},
				Status:      "discovered",
				Source:      "scan",
			})
			return nil
		})
	}
	return projects, nil
}

func (s *Service) Up(ctx context.Context, req UpRequest) (string, error) {
	dir, files, cleanup, err := resolveCompose(req)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	args := composeArgs(files, req.ProjectName)
	args = append(args, "up", "-d")
	return runDocker(ctx, dir, args...)
}

func (s *Service) Down(ctx context.Context, req UpRequest) (string, error) {
	dir, files, cleanup, err := resolveComposeOptionalFile(req)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	args := composeArgs(files, req.ProjectName)
	args = append(args, "down")
	return runDocker(ctx, dir, args...)
}

func (s *Service) Restart(ctx context.Context, req UpRequest) (string, error) {
	dir, files, cleanup, err := resolveComposeOptionalFile(req)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	args := composeArgs(files, req.ProjectName)
	args = append(args, "restart")
	return runDocker(ctx, dir, args...)
}

func (s *Service) Ps(ctx context.Context, req UpRequest) (string, error) {
	dir, files, cleanup, err := resolveComposeOptionalFile(req)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	args := composeArgs(files, req.ProjectName)
	args = append(args, "ps", "--format", "json")
	return runDocker(ctx, dir, args...)
}

// Services returns per-service status for a project.
func (s *Service) Services(ctx context.Context, req UpRequest) ([]ServiceInfo, error) {
	out, err := s.Ps(ctx, req)
	if err != nil {
		return nil, err
	}
	out = strings.TrimSpace(out)
	if out == "" || out == "null" {
		return []ServiceInfo{}, nil
	}
	parseRow := func(raw []byte) (ServiceInfo, error) {
		var row map[string]any
		if err := json.Unmarshal(raw, &row); err != nil {
			return ServiceInfo{}, err
		}
		name, _ := row["Service"].(string)
		if name == "" {
			name, _ = row["Name"].(string)
		}
		state, _ := row["State"].(string)
		status, _ := row["Status"].(string)
		image, _ := row["Image"].(string)
		proj, _ := row["Project"].(string)
		return ServiceInfo{Name: name, State: state, Status: status, Image: image, Project: proj}, nil
	}
	var services []ServiceInfo
	if strings.HasPrefix(out, "[") {
		var rows []json.RawMessage
		if err := json.Unmarshal([]byte(out), &rows); err != nil {
			return nil, fmt.Errorf("parse compose ps: %w", err)
		}
		for _, raw := range rows {
			svc, err := parseRow(raw)
			if err != nil {
				return nil, err
			}
			services = append(services, svc)
		}
		return services, nil
	}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		svc, err := parseRow([]byte(line))
		if err != nil {
			return nil, fmt.Errorf("parse compose ps: %w", err)
		}
		services = append(services, svc)
	}
	return services, nil
}

// ServiceAction runs start/stop/restart for one or more services.
func (s *Service) ServiceAction(ctx context.Context, req UpRequest, action string, services []string) (string, error) {
	action = strings.ToLower(strings.TrimSpace(action))
	switch action {
	case "start", "stop", "restart":
	default:
		return "", fmt.Errorf("unsupported action %q", action)
	}
	dir, files, cleanup, err := resolveComposeOptionalFile(req)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	args := composeArgs(files, req.ProjectName)
	args = append(args, action)
	args = append(args, services...)
	return runDocker(ctx, dir, args...)
}

func composeArgs(files []string, projectName string) []string {
	args := []string{"compose"}
	for _, f := range files {
		if f != "" {
			args = append(args, "-f", f)
		}
	}
	if projectName != "" {
		args = append(args, "-p", projectName)
	}
	return args
}

func resolveCompose(req UpRequest) (dir string, files []string, cleanup func(), err error) {
	if files = existingFiles(req.ConfigFiles); len(files) > 0 {
		return filepath.Dir(files[0]), files, nil, nil
	}
	if req.Path != "" {
		abs, e := filepath.Abs(req.Path)
		if e != nil {
			return "", nil, nil, e
		}
		st, e := os.Stat(abs)
		if e != nil {
			return "", nil, nil, e
		}
		if st.IsDir() {
			for _, name := range composeFileNames {
				candidate := filepath.Join(abs, name)
				if _, e := os.Stat(candidate); e == nil {
					return abs, []string{candidate}, nil, nil
				}
			}
			return "", nil, nil, fmt.Errorf("no compose file in %s", abs)
		}
		return filepath.Dir(abs), []string{abs}, nil, nil
	}
	if strings.TrimSpace(req.YAML) == "" {
		return "", nil, nil, fmt.Errorf("path or yaml required")
	}
	tmp, e := os.MkdirTemp("", "deckhand-compose-*")
	if e != nil {
		return "", nil, nil, e
	}
	path := filepath.Join(tmp, "compose.yaml")
	if e := os.WriteFile(path, []byte(req.YAML), 0o600); e != nil {
		_ = os.RemoveAll(tmp)
		return "", nil, nil, e
	}
	return tmp, []string{path}, func() { _ = os.RemoveAll(tmp) }, nil
}

// resolveComposeOptionalFile allows down/restart/ps with only a project name
// (engine-known projects) when no path/yaml is provided.
func resolveComposeOptionalFile(req UpRequest) (dir string, files []string, cleanup func(), err error) {
	if len(existingFiles(req.ConfigFiles)) > 0 || req.Path != "" || strings.TrimSpace(req.YAML) != "" {
		return resolveCompose(req)
	}
	if req.ProjectName == "" {
		return "", nil, nil, fmt.Errorf("path, yaml, or projectName required")
	}
	return "", nil, nil, nil
}

func splitConfigFiles(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func existingFiles(paths []string) []string {
	if len(paths) == 0 {
		return nil
	}
	out := make([]string, 0, len(paths))
	seen := map[string]struct{}{}
	for _, p := range paths {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		st, err := os.Stat(abs)
		if err != nil || st.IsDir() {
			continue
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		out = append(out, abs)
	}
	return out
}

func runDocker(ctx context.Context, dir string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "docker", args...)
	if dir != "" {
		cmd.Dir = dir
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("%w: %s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
