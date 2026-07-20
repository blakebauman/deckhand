package docker

import (
	"context"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
)

const debugImage = "nicolaka/netshoot:latest"

// DebugShellResult is a started debug sidecar sharing the target's network namespace.
type DebugShellResult struct {
	ID      string `json:"id"`
	Target  string `json:"target"`
	Image   string `json:"image"`
	Started bool   `json:"started"`
}

// StartDebugShell launches a toolbox container joined to the target's network namespace.
func (c *Client) StartDebugShell(ctx context.Context, targetID string) (DebugShellResult, error) {
	if !c.Ready() {
		return DebugShellResult{}, c.err
	}
	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		return DebugShellResult{}, fmt.Errorf("target container required")
	}
	insp, err := c.cli.ContainerInspect(ctx, targetID)
	if err != nil {
		return DebugShellResult{}, err
	}
	_ = c.ensureImage(ctx, debugImage)

	cfg := &container.Config{
		Image:     debugImage,
		Tty:       true,
		OpenStdin: true,
		Cmd:       []string{"bash"},
	}
	host := &container.HostConfig{
		NetworkMode: container.NetworkMode("container:" + insp.ID),
		CapAdd:      []string{"NET_ADMIN", "SYS_PTRACE"},
		// Optional: share PID namespace when supported
		PidMode: container.PidMode("container:" + insp.ID),
	}
	// Prefer not to fail if pid mode unsupported — retry without
	resp, err := c.cli.ContainerCreate(ctx, cfg, host, &network.NetworkingConfig{}, nil, "deckhand-debug-"+dockerShort(insp.ID))
	if err != nil {
		host.PidMode = ""
		resp, err = c.cli.ContainerCreate(ctx, cfg, host, nil, nil, "deckhand-debug-"+dockerShort(insp.ID))
		if err != nil {
			return DebugShellResult{}, err
		}
	}
	if err := c.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return DebugShellResult{ID: resp.ID, Target: insp.ID, Image: debugImage}, err
	}
	return DebugShellResult{ID: resp.ID, Target: insp.ID, Image: debugImage, Started: true}, nil
}

func dockerShort(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}
