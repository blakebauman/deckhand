package k8s

import (
	"bytes"
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

func (c *Client) Exec(ctx context.Context, ns, name, container string, cmd []string) (string, error) {
	if err := c.ensureReady(); err != nil {
		return "", err
	}
	if len(cmd) == 0 {
		cmd = []string{"sh", "-c", "uname -a; id"}
	}
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(name).
		Namespace(ns).
		SubResource("exec")
	opts := &corev1.PodExecOptions{
		Container: container,
		Command:   cmd,
		Stdout:    true,
		Stderr:    true,
	}
	req.VersionedParams(opts, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.config, "POST", req.URL())
	if err != nil {
		return "", fmt.Errorf("exec: %w", err)
	}
	var stdout, stderr bytes.Buffer
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})
	out := stdout.String()
	if stderr.Len() > 0 {
		out += stderr.String()
	}
	if err != nil {
		return out, err
	}
	return out, nil
}
