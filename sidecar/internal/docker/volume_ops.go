package docker

import (
	"archive/tar"
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
)

// VolumeFileEntry is a file listing entry inside a named volume.
type VolumeFileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Dir   bool   `json:"dir"`
	Size  int64  `json:"size"`
	Mode  string `json:"mode,omitempty"`
	ModTime string `json:"modTime,omitempty"`
}

// ListVolumeFiles lists files in a volume via a short-lived helper container.
func (c *Client) ListVolumeFiles(ctx context.Context, volumeName, rel string) ([]VolumeFileEntry, error) {
	if !c.Ready() {
		return nil, c.err
	}
	rel = cleanVolPath(rel)
	helper := "alpine:3.20"
	listPath := "/data"
	if rel != "" {
		listPath = "/data/" + rel
	}
	cfg := &container.Config{
		Image:      helper,
		Entrypoint: []string{"sh", "-c"},
		Cmd:        []string{fmt.Sprintf("ls -la %q", listPath)},
		WorkingDir: "/data",
	}
	host := &container.HostConfig{
		AutoRemove: true,
		Mounts: []mount.Mount{{
			Type:   mount.TypeVolume,
			Source: volumeName,
			Target: "/data",
		}},
	}
	resp, err := c.cli.ContainerCreate(ctx, cfg, host, nil, nil, "")
	if err != nil {
		// pull alpine once
		if pullErr := c.ensureImage(ctx, helper); pullErr != nil {
			return nil, fmt.Errorf("helper image: %w (create: %v)", pullErr, err)
		}
		resp, err = c.cli.ContainerCreate(ctx, cfg, host, nil, nil, "")
		if err != nil {
			return nil, err
		}
	}
	if err := c.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = c.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, err
	}
	statusCh, errCh := c.cli.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case <-statusCh:
	case err := <-errCh:
		if err != nil {
			return nil, err
		}
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	logs, err := c.cli.ContainerLogs(ctx, resp.ID, container.LogsOptions{ShowStdout: true, ShowStderr: true})
	if err != nil {
		return nil, err
	}
	defer logs.Close()
	var buf strings.Builder
	_ = DemuxLogs(logs, &buf)
	return parseLSListing(buf.String(), rel), nil
}

func (c *Client) ensureImage(ctx context.Context, ref string) error {
	rc, err := c.cli.ImagePull(ctx, ref, image.PullOptions{})
	if err != nil {
		return err
	}
	defer rc.Close()
	_, _ = io.Copy(io.Discard, rc)
	return nil
}

func cleanVolPath(rel string) string {
	rel = strings.TrimSpace(rel)
	rel = strings.TrimPrefix(rel, "/")
	rel = path.Clean("/" + rel)
	rel = strings.TrimPrefix(rel, "/")
	if rel == "." {
		return ""
	}
	return rel
}

func parseLSListing(out, base string) []VolumeFileEntry {
	lines := strings.Split(out, "\n")
	var entries []VolumeFileEntry
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "total ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 8 {
			continue
		}
		name := fields[len(fields)-1]
		if name == "." || name == ".." {
			continue
		}
		dir := strings.HasPrefix(fields[0], "d")
		var size int64
		fmt.Sscanf(fields[4], "%d", &size)
		p := name
		if base != "" {
			p = path.Join(base, name)
		}
		entries = append(entries, VolumeFileEntry{
			Name: name, Path: p, Dir: dir, Size: size, Mode: fields[0],
		})
	}
	return entries
}

// CloneVolume copies data from src to a new volume dest using a helper container.
func (c *Client) CloneVolume(ctx context.Context, src, dest string) error {
	if !c.Ready() {
		return c.err
	}
	src = strings.TrimSpace(src)
	dest = strings.TrimSpace(dest)
	if src == "" || dest == "" {
		return fmt.Errorf("source and dest volume names required")
	}
	if _, err := c.CreateVolume(ctx, dest); err != nil {
		return err
	}
	helper := "alpine:3.20"
	_ = c.ensureImage(ctx, helper)
	cfg := &container.Config{
		Image:      helper,
		Entrypoint: []string{"sh", "-c"},
		Cmd:        []string{"cp -a /from/. /to/"},
	}
	host := &container.HostConfig{
		AutoRemove: true,
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: src, Target: "/from", ReadOnly: true},
			{Type: mount.TypeVolume, Source: dest, Target: "/to"},
		},
	}
	resp, err := c.cli.ContainerCreate(ctx, cfg, host, nil, nil, "")
	if err != nil {
		return err
	}
	if err := c.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return err
	}
	statusCh, errCh := c.cli.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case st := <-statusCh:
		if st.StatusCode != 0 {
			return fmt.Errorf("clone failed with exit %d", st.StatusCode)
		}
		return nil
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ExportVolume writes a tar archive of the volume to w.
func (c *Client) ExportVolume(ctx context.Context, name string, w io.Writer) error {
	if !c.Ready() {
		return c.err
	}
	helper := "alpine:3.20"
	_ = c.ensureImage(ctx, helper)
	cfg := &container.Config{
		Image:      helper,
		Entrypoint: []string{"tar"},
		Cmd:        []string{"-cf", "-", "-C", "/data", "."},
	}
	host := &container.HostConfig{
		AutoRemove: false,
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: name, Target: "/data", ReadOnly: true},
		},
	}
	resp, err := c.cli.ContainerCreate(ctx, cfg, host, nil, nil, "")
	if err != nil {
		return err
	}
	defer func() { _ = c.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true}) }()
	hijacked, err := c.cli.ContainerAttach(ctx, resp.ID, container.AttachOptions{Stream: true, Stdout: true, Stderr: true})
	if err != nil {
		return err
	}
	defer hijacked.Close()
	if err := c.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return err
	}
	return DemuxLogs(hijacked.Reader, w)
}

// ImportVolume creates (or uses) a volume and extracts tar from r into it.
func (c *Client) ImportVolume(ctx context.Context, name string, r io.Reader) error {
	if !c.Ready() {
		return c.err
	}
	if _, err := c.InspectVolume(ctx, name); err != nil {
		if _, err := c.CreateVolume(ctx, name); err != nil {
			return err
		}
	}
	// Write tar to temp file, mount into helper
	tmp, err := os.CreateTemp("", "deckhand-vol-*.tar")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := io.Copy(tmp, r); err != nil {
		tmp.Close()
		return err
	}
	tmp.Close()

	helper := "alpine:3.20"
	_ = c.ensureImage(ctx, helper)
	cfg := &container.Config{
		Image:      helper,
		Entrypoint: []string{"sh", "-c"},
		Cmd:        []string{"tar -xf /import/archive.tar -C /data"},
	}
	host := &container.HostConfig{
		AutoRemove: true,
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: name, Target: "/data"},
			{Type: mount.TypeBind, Source: tmp.Name(), Target: "/import/archive.tar", ReadOnly: true},
		},
	}
	resp, err := c.cli.ContainerCreate(ctx, cfg, host, nil, nil, "")
	if err != nil {
		return err
	}
	if err := c.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return err
	}
	statusCh, errCh := c.cli.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case st := <-statusCh:
		if st.StatusCode != 0 {
			return fmt.Errorf("import failed with exit %d", st.StatusCode)
		}
		return nil
	case err := <-errCh:
		return err
	case <-time.After(10 * time.Minute):
		return fmt.Errorf("import timed out")
	}
}

// ListImageFiles lists top-level paths in an image via create+archive.
func (c *Client) ListImageFiles(ctx context.Context, imageRef, rel string) ([]VolumeFileEntry, error) {
	if !c.Ready() {
		return nil, c.err
	}
	rel = cleanVolPath(rel)
	target := "/"
	if rel != "" {
		target = "/" + rel
	}
	resp, err := c.cli.ContainerCreate(ctx, &container.Config{Image: imageRef}, &container.HostConfig{}, nil, nil, "")
	if err != nil {
		return nil, err
	}
	defer func() { _ = c.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true}) }()
	rc, _, err := c.cli.CopyFromContainer(ctx, resp.ID, target)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	tr := tar.NewReader(rc)
	var entries []VolumeFileEntry
	seen := map[string]bool{}
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return entries, err
		}
		name := strings.TrimPrefix(hdr.Name, "./")
		name = strings.Trim(name, "/")
		if name == "" {
			continue
		}
		// only immediate children
		parts := strings.Split(name, "/")
		top := parts[0]
		if seen[top] {
			continue
		}
		seen[top] = true
		dir := hdr.FileInfo().IsDir() || len(parts) > 1
		entries = append(entries, VolumeFileEntry{
			Name: top,
			Path: path.Join(rel, top),
			Dir:  dir,
			Size: hdr.Size,
			Mode: hdr.FileInfo().Mode().String(),
			ModTime: hdr.ModTime.Format(time.RFC3339),
		})
		if len(entries) > 500 {
			break
		}
	}
	_ = filepath.Separator // keep import used on all platforms
	return entries, nil
}
