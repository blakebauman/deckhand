package k8s

import (
	"context"
	"fmt"
	"io"
	"sync"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

type sizeQueue struct {
	ch   chan remotecommand.TerminalSize
	once sync.Once
}

func newSizeQueue() *sizeQueue {
	return &sizeQueue{ch: make(chan remotecommand.TerminalSize, 4)}
}

func (q *sizeQueue) Next() *remotecommand.TerminalSize {
	size, ok := <-q.ch
	if !ok {
		return nil
	}
	return &size
}

func (q *sizeQueue) Resize(cols, rows uint16) {
	select {
	case q.ch <- remotecommand.TerminalSize{Width: cols, Height: rows}:
	default:
		// drop if consumer is slow
	}
}

func (q *sizeQueue) Close() {
	q.once.Do(func() { close(q.ch) })
}

// ExecTTY runs an interactive shell in a pod, bridging stdin/stdout to rw and
// accepting resize via the returned Resize func. Blocks until the stream ends.
func (c *Client) ExecTTY(
	ctx context.Context,
	ns, name, container string,
	cmd []string,
	stdin io.Reader,
	stdout io.Writer,
) (resize func(cols, rows uint16), wait func() error, err error) {
	if err := c.ensureReady(); err != nil {
		return nil, nil, err
	}
	if len(cmd) == 0 {
		cmd = []string{"/bin/sh"}
	}
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(name).
		Namespace(ns).
		SubResource("exec")
	opts := &corev1.PodExecOptions{
		Container: container,
		Command:   cmd,
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}
	req.VersionedParams(opts, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(c.config, "POST", req.URL())
	if err != nil {
		return nil, nil, fmt.Errorf("exec: %w", err)
	}

	sq := newSizeQueue()
	done := make(chan error, 1)
	go func() {
		done <- executor.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:             stdin,
			Stdout:            stdout,
			Stderr:            stdout,
			Tty:               true,
			TerminalSizeQueue: sq,
		})
		sq.Close()
	}()

	return sq.Resize, func() error { return <-done }, nil
}
