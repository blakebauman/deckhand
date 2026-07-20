package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

type Client struct {
	cli           *client.Client
	err           error
	activeHost    string
	activeContext string
}

func New() *Client {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	return &Client{cli: cli, err: err}
}

// ReconnectWithHost replaces the underlying SDK client for a Docker context switch.
func (c *Client) ReconnectWithHost(host string) error {
	opts := []client.Opt{client.WithAPIVersionNegotiation()}
	if host != "" {
		opts = append(opts, client.WithHost(host))
	} else {
		opts = append(opts, client.FromEnv)
	}
	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		c.err = err
		return err
	}
	if c.cli != nil {
		_ = c.cli.Close()
	}
	c.cli = cli
	c.err = nil
	c.activeHost = host
	return nil
}

func (c *Client) SetActiveContext(name string) { c.activeContext = name }
func (c *Client) ActiveContext() string        { return c.activeContext }
func (c *Client) ActiveHost() string           { return c.activeHost }

func (c *Client) Ready() bool {
	return c.cli != nil && c.err == nil
}

func (c *Client) Err() error { return c.err }

func (c *Client) Ping(ctx context.Context) error {
	if !c.Ready() {
		return fmt.Errorf("docker unavailable: %v", c.err)
	}
	_, err := c.cli.Ping(ctx)
	return err
}

func (c *Client) Info(ctx context.Context) (system.Info, error) {
	if !c.Ready() {
		return system.Info{}, c.err
	}
	return c.cli.Info(ctx)
}

func (c *Client) Version(ctx context.Context) (types.Version, error) {
	if !c.Ready() {
		return types.Version{}, c.err
	}
	return c.cli.ServerVersion(ctx)
}

type ContainerSummary struct {
	ID      string            `json:"id"`
	Names   []string          `json:"names"`
	Image   string            `json:"image"`
	Status  string            `json:"status"`
	State   string            `json:"state"`
	Ports   []types.Port      `json:"ports"`
	Created int64             `json:"created"`
	Labels  map[string]string `json:"labels"`
	GPU     bool              `json:"gpu"`
}

func (c *Client) ListContainers(ctx context.Context, all bool) ([]ContainerSummary, error) {
	if !c.Ready() {
		return nil, c.err
	}
	list, err := c.cli.ContainerList(ctx, container.ListOptions{All: all})
	if err != nil {
		return nil, err
	}
	out := make([]ContainerSummary, 0, len(list))
	for _, item := range list {
		sum := ContainerSummary{
			ID: item.ID, Names: item.Names, Image: item.Image,
			Status: item.Status, State: item.State, Ports: item.Ports,
			Created: item.Created, Labels: item.Labels,
		}
		// Detect GPU assignment (DeviceRequests / nvidia devices). Cap inspect cost.
		if item.State == "running" && len(list) <= 80 {
			if insp, err := c.cli.ContainerInspect(ctx, item.ID); err == nil && insp.HostConfig != nil {
				if len(insp.HostConfig.DeviceRequests) > 0 {
					sum.GPU = true
				}
				for _, d := range insp.HostConfig.Devices {
					if strings.Contains(strings.ToLower(d.PathOnHost), "nvidia") {
						sum.GPU = true
						break
					}
				}
			}
		}
		out = append(out, sum)
	}
	return out, nil
}

func (c *Client) InspectContainer(ctx context.Context, id string) (types.ContainerJSON, error) {
	return c.cli.ContainerInspect(ctx, id)
}

func (c *Client) StartContainer(ctx context.Context, id string) error {
	return c.cli.ContainerStart(ctx, id, container.StartOptions{})
}

func (c *Client) StopContainer(ctx context.Context, id string, timeout *int) error {
	return c.cli.ContainerStop(ctx, id, container.StopOptions{Timeout: timeout})
}

func (c *Client) RestartContainer(ctx context.Context, id string, timeout *int) error {
	return c.cli.ContainerRestart(ctx, id, container.StopOptions{Timeout: timeout})
}

func (c *Client) RemoveContainer(ctx context.Context, id string, force bool) error {
	return c.cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: force})
}

func (c *Client) ContainerLogs(ctx context.Context, id string, follow bool, tail string) (io.ReadCloser, error) {
	return c.cli.ContainerLogs(ctx, id, container.LogsOptions{
		ShowStdout: true, ShowStderr: true, Follow: follow, Tail: tail, Timestamps: true,
	})
}

func DemuxLogs(r io.Reader, w io.Writer) error {
	_, err := stdcopy.StdCopy(w, w, r)
	return err
}

func (c *Client) ListImages(ctx context.Context) ([]image.Summary, error) {
	return c.cli.ImageList(ctx, image.ListOptions{All: true})
}

func (c *Client) PullImage(ctx context.Context, ref string) (io.ReadCloser, error) {
	return c.cli.ImagePull(ctx, ref, image.PullOptions{})
}

func (c *Client) RemoveImage(ctx context.Context, id string, force bool) ([]image.DeleteResponse, error) {
	return c.cli.ImageRemove(ctx, id, image.RemoveOptions{Force: force})
}

func (c *Client) PruneImages(ctx context.Context) (image.PruneReport, error) {
	return c.cli.ImagesPrune(ctx, filters.Args{})
}

func (c *Client) ListVolumes(ctx context.Context) (volume.ListResponse, error) {
	return c.cli.VolumeList(ctx, volume.ListOptions{})
}

func (c *Client) CreateVolume(ctx context.Context, name string) (volume.Volume, error) {
	return c.cli.VolumeCreate(ctx, volume.CreateOptions{Name: name})
}

func (c *Client) InspectVolume(ctx context.Context, name string) (volume.Volume, error) {
	return c.cli.VolumeInspect(ctx, name)
}

func (c *Client) RemoveVolume(ctx context.Context, name string, force bool) error {
	return c.cli.VolumeRemove(ctx, name, force)
}

func (c *Client) ListNetworks(ctx context.Context) ([]network.Summary, error) {
	return c.cli.NetworkList(ctx, network.ListOptions{})
}

func (c *Client) CreateNetwork(ctx context.Context, name, driver string) (network.CreateResponse, error) {
	if driver == "" {
		driver = "bridge"
	}
	return c.cli.NetworkCreate(ctx, name, network.CreateOptions{Driver: driver})
}

func (c *Client) InspectNetwork(ctx context.Context, id string) (network.Inspect, error) {
	return c.cli.NetworkInspect(ctx, id, network.InspectOptions{})
}

func (c *Client) RemoveNetwork(ctx context.Context, id string) error {
	return c.cli.NetworkRemove(ctx, id)
}

func (c *Client) Events(ctx context.Context) (<-chan events.Message, <-chan error) {
	return c.cli.Events(ctx, events.ListOptions{})
}

func (c *Client) Raw() *client.Client { return c.cli }

func DashboardCounts(ctx context.Context, c *Client) (map[string]int, error) {
	counts := map[string]int{
		"containers": 0, "containersRunning": 0, "containersPaused": 0,
		"images": 0, "volumes": 0, "networks": 0,
	}
	if !c.Ready() {
		return counts, c.err
	}
	// Prefer engine Info — matches `docker info` and avoids list/filter drift.
	info, err := c.Info(ctx)
	if err != nil {
		return counts, err
	}
	counts["containers"] = info.Containers
	counts["containersRunning"] = info.ContainersRunning
	counts["containersPaused"] = info.ContainersPaused
	counts["images"] = info.Images

	vols, err := c.ListVolumes(ctx)
	if err != nil {
		return counts, err
	}
	counts["volumes"] = len(vols.Volumes)
	nets, err := c.ListNetworks(ctx)
	if err != nil {
		return counts, err
	}
	counts["networks"] = len(nets)
	return counts, nil
}

func ShortID(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

func ContainerName(names []string) string {
	if len(names) == 0 {
		return ""
	}
	return strings.TrimPrefix(names[0], "/")
}

func EncodeJSON(w io.Writer, v any) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func WithTimeout(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, d)
}
