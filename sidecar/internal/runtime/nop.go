//go:build !linux

package runtime

import (
	"context"
	"fmt"
)

// Firecracker is unavailable on non-Linux platforms.
type Firecracker struct{}

func NewFirecracker() *Firecracker { return &Firecracker{} }

func (f *Firecracker) Name() string { return "firecracker" }

func (f *Firecracker) Available(context.Context) bool { return false }

func (f *Firecracker) List(context.Context) ([]VM, error) {
	return nil, fmt.Errorf("firecracker not available on this platform")
}

func (f *Firecracker) Create(context.Context, CreateRequest) (*VM, error) {
	return nil, fmt.Errorf("firecracker not available on this platform")
}

func (f *Firecracker) Start(context.Context, string) error {
	return fmt.Errorf("firecracker not available on this platform")
}

func (f *Firecracker) Stop(context.Context, string) error {
	return fmt.Errorf("firecracker not available on this platform")
}

func (f *Firecracker) Destroy(context.Context, string) error {
	return fmt.Errorf("firecracker not available on this platform")
}

func (f *Firecracker) Logs(context.Context, string) (string, error) {
	return "", fmt.Errorf("firecracker not available on this platform")
}
