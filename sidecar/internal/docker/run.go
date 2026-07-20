package docker

import (
	"context"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

// RunOptions is a create/run form payload.
type RunOptions struct {
	Image      string   `json:"image"`
	Name       string   `json:"name"`
	Cmd        string   `json:"cmd"`
	Env        []string `json:"env"`
	Ports      []string `json:"ports"`
	Start      bool     `json:"start"`
	GPU        bool     `json:"gpu"`
	AutoRemove bool     `json:"autoRemove"`
	Restart    string   `json:"restart"`
	WorkDir    string   `json:"workdir"`
	Network    string   `json:"network"`
}

type RunResult struct {
	ID       string   `json:"id"`
	Warnings []string `json:"warnings,omitempty"`
	Started  bool     `json:"started"`
}

func (c *Client) CreateAndRun(ctx context.Context, opts RunOptions) (RunResult, error) {
	if !c.Ready() {
		return RunResult{}, c.err
	}
	opts.Image = strings.TrimSpace(opts.Image)
	if opts.Image == "" {
		return RunResult{}, fmt.Errorf("image is required")
	}

	var exposed nat.PortSet
	var bindings nat.PortMap
	if len(opts.Ports) > 0 {
		cleaned := make([]string, 0, len(opts.Ports))
		for _, p := range opts.Ports {
			p = strings.TrimSpace(p)
			if p != "" {
				cleaned = append(cleaned, p)
			}
		}
		if len(cleaned) > 0 {
			var err error
			exposed, bindings, err = nat.ParsePortSpecs(cleaned)
			if err != nil {
				return RunResult{}, fmt.Errorf("ports: %w", err)
			}
		}
	}

	cfg := &container.Config{
		Image:        opts.Image,
		Env:          normalizeEnv(opts.Env),
		ExposedPorts: exposed,
		WorkingDir:   strings.TrimSpace(opts.WorkDir),
	}
	if cmd := strings.TrimSpace(opts.Cmd); cmd != "" {
		cfg.Cmd = []string{"sh", "-c", cmd}
	}

	host := &container.HostConfig{
		PortBindings: bindings,
		AutoRemove:   opts.AutoRemove,
	}
	if opts.GPU {
		host.DeviceRequests = []container.DeviceRequest{{
			Driver:       "nvidia",
			Count:        -1,
			Capabilities: [][]string{{"gpu"}},
		}}
	}
	switch strings.TrimSpace(opts.Restart) {
	case "always":
		host.RestartPolicy = container.RestartPolicy{Name: container.RestartPolicyAlways}
	case "unless-stopped":
		host.RestartPolicy = container.RestartPolicy{Name: container.RestartPolicyUnlessStopped}
	case "on-failure":
		host.RestartPolicy = container.RestartPolicy{Name: container.RestartPolicyOnFailure}
	case "no", "":
		// default
	default:
		return RunResult{}, fmt.Errorf("invalid restart policy %q", opts.Restart)
	}

	var networking *network.NetworkingConfig
	if netName := strings.TrimSpace(opts.Network); netName != "" {
		networking = &network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				netName: {},
			},
		}
	}

	resp, err := c.cli.ContainerCreate(ctx, cfg, host, networking, nil, strings.TrimSpace(opts.Name))
	if err != nil {
		return RunResult{}, err
	}

	started := false
	if opts.Start {
		if err := c.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
			return RunResult{ID: resp.ID, Warnings: resp.Warnings, Started: false}, err
		}
		started = true
	}

	return RunResult{ID: resp.ID, Warnings: resp.Warnings, Started: started}, nil
}

func normalizeEnv(env []string) []string {
	out := make([]string, 0, len(env))
	for _, e := range env {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		if !strings.Contains(e, "=") {
			e = e + "="
		}
		out = append(out, e)
	}
	return out
}
