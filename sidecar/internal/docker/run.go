package docker

import (
	"context"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

// MountSpec is a bind or named-volume mount for create/run.
type MountSpec struct {
	Type     string `json:"type"`     // bind | volume (default volume if Source has no path sep)
	Source   string `json:"source"`   // host path or volume name
	Target   string `json:"target"`   // container path
	ReadOnly bool   `json:"readOnly"`
}

// RunOptions is a create/run form payload.
type RunOptions struct {
	Image      string      `json:"image"`
	Name       string      `json:"name"`
	Cmd        string      `json:"cmd"`
	Env        []string    `json:"env"`
	Ports      []string    `json:"ports"`
	Mounts     []MountSpec `json:"mounts"`
	Start      bool        `json:"start"`
	GPU        bool        `json:"gpu"`
	AutoRemove bool        `json:"autoRemove"`
	Restart    string      `json:"restart"`
	WorkDir    string      `json:"workdir"`
	Network    string      `json:"network"`
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
	if mounts, err := parseMounts(opts.Mounts); err != nil {
		return RunResult{}, err
	} else if len(mounts) > 0 {
		host.Mounts = mounts
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

func parseMounts(specs []MountSpec) ([]mount.Mount, error) {
	if len(specs) == 0 {
		return nil, nil
	}
	out := make([]mount.Mount, 0, len(specs))
	for _, s := range specs {
		src := strings.TrimSpace(s.Source)
		tgt := strings.TrimSpace(s.Target)
		if src == "" || tgt == "" {
			return nil, fmt.Errorf("mount requires source and target")
		}
		typ := strings.TrimSpace(strings.ToLower(s.Type))
		if typ == "" {
			if strings.HasPrefix(src, "/") || strings.HasPrefix(src, "./") || strings.HasPrefix(src, "../") ||
				(len(src) > 1 && src[1] == ':') {
				typ = "bind"
			} else {
				typ = "volume"
			}
		}
		m := mount.Mount{Source: src, Target: tgt, ReadOnly: s.ReadOnly}
		switch typ {
		case "bind":
			m.Type = mount.TypeBind
		case "volume":
			m.Type = mount.TypeVolume
		case "tmpfs":
			m.Type = mount.TypeTmpfs
			m.Source = ""
		default:
			return nil, fmt.Errorf("unsupported mount type %q", typ)
		}
		out = append(out, m)
	}
	return out, nil
}
