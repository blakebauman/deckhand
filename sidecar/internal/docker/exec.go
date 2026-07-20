package docker

import (
	"bytes"
	"context"
	"io"

	"github.com/docker/docker/api/types/container"
)

func (c *Client) Exec(ctx context.Context, id string, cmd []string) (string, error) {
	if len(cmd) == 0 {
		cmd = []string{"sh", "-c", "echo deckhand-exec-ok"}
	}
	execID, err := c.cli.ContainerExecCreate(ctx, id, container.ExecOptions{
		AttachStdout: true,
		AttachStderr: true,
		Cmd:          cmd,
	})
	if err != nil {
		return "", err
	}
	resp, err := c.cli.ContainerExecAttach(ctx, execID.ID, container.ExecAttachOptions{})
	if err != nil {
		return "", err
	}
	defer resp.Close()
	var buf bytes.Buffer
	_, _ = io.Copy(&buf, resp.Reader)
	return buf.String(), nil
}
