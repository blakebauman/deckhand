package docker

import (
	"context"
	"fmt"
	"io"

	"github.com/docker/docker/api/types/container"
)

// ExecTTYSession is an interactive TTY exec against a container.
type ExecTTYSession struct {
	ID     string
	Stdin  io.Writer
	Stdout io.Reader
	close  func()
}

func (s *ExecTTYSession) Close() error {
	if s.close != nil {
		s.close()
	}
	return nil
}

// ExecTTY starts an interactive shell (or custom cmd) with a TTY attached.
func (c *Client) ExecTTY(ctx context.Context, id string, cmd []string) (*ExecTTYSession, error) {
	if !c.Ready() {
		return nil, c.err
	}
	if len(cmd) == 0 {
		cmd = []string{"/bin/sh"}
	}
	created, err := c.cli.ContainerExecCreate(ctx, id, container.ExecOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd:          cmd,
	})
	if err != nil {
		return nil, err
	}
	resp, err := c.cli.ContainerExecAttach(ctx, created.ID, container.ExecAttachOptions{Tty: true})
	if err != nil {
		return nil, err
	}
	return &ExecTTYSession{
		ID:     created.ID,
		Stdin:  resp.Conn,
		Stdout: resp.Reader,
		close:  func() { resp.Close() },
	}, nil
}

// ResizeTTY resizes an active exec TTY.
func (c *Client) ResizeTTY(ctx context.Context, execID string, cols, rows uint) error {
	if !c.Ready() {
		return c.err
	}
	if cols == 0 || rows == 0 {
		return fmt.Errorf("invalid terminal size")
	}
	return c.cli.ContainerExecResize(ctx, execID, container.ResizeOptions{
		Width:  cols,
		Height: rows,
	})
}
