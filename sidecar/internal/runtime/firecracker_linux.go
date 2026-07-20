//go:build linux

package runtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// Firecracker manages local microVMs when KVM and the firecracker binary are present.
// Full firecracker-go-sdk wiring can replace the process-based stub as needed.
type Firecracker struct {
	mu     sync.Mutex
	vms    map[string]*VM
	logs   map[string]*strings.Builder
	bin    string
	hasKVM bool
}

func NewFirecracker() *Firecracker {
	bin, _ := exec.LookPath("firecracker")
	_, kvmErr := os.Stat("/dev/kvm")
	return &Firecracker{
		vms:    make(map[string]*VM),
		logs:   make(map[string]*strings.Builder),
		bin:    bin,
		hasKVM: kvmErr == nil,
	}
}

func (f *Firecracker) Name() string { return "firecracker" }

func (f *Firecracker) Available(context.Context) bool {
	return f.bin != "" && f.hasKVM
}

func (f *Firecracker) List(context.Context) ([]VM, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]VM, 0, len(f.vms))
	for _, vm := range f.vms {
		out = append(out, *vm)
	}
	return out, nil
}

func (f *Firecracker) Create(_ context.Context, req CreateRequest) (*VM, error) {
	if !f.Available(context.Background()) {
		return nil, fmt.Errorf("firecracker not available")
	}
	if req.Name == "" {
		req.Name = "vm-" + newID()[:8]
	}
	if req.VCPU <= 0 {
		req.VCPU = 1
	}
	if req.Memory <= 0 {
		req.Memory = 512
	}
	if req.Kernel == "" || req.Rootfs == "" {
		return nil, fmt.Errorf("kernel and rootfs paths are required")
	}
	if _, err := os.Stat(req.Kernel); err != nil {
		return nil, fmt.Errorf("kernel: %w", err)
	}
	if _, err := os.Stat(req.Rootfs); err != nil {
		return nil, fmt.Errorf("rootfs: %w", err)
	}

	vm := &VM{
		ID:     newID(),
		Name:   req.Name,
		State:  "created",
		VCPU:   req.VCPU,
		Memory: req.Memory,
		Kernel: filepath.Clean(req.Kernel),
		Rootfs: filepath.Clean(req.Rootfs),
	}
	f.mu.Lock()
	f.vms[vm.ID] = vm
	f.logs[vm.ID] = &strings.Builder{}
	fmt.Fprintf(f.logs[vm.ID], "[%s] created vm %s kernel=%s rootfs=%s\n", time.Now().Format(time.RFC3339), vm.Name, vm.Kernel, vm.Rootfs)
	f.mu.Unlock()
	return vm, nil
}

func (f *Firecracker) Start(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	vm, ok := f.vms[id]
	if !ok {
		return fmt.Errorf("vm not found")
	}
	vm.State = "running"
	if b := f.logs[id]; b != nil {
		fmt.Fprintf(b, "[%s] started (firecracker=%s)\n", time.Now().Format(time.RFC3339), f.bin)
	}
	return nil
}

func (f *Firecracker) Stop(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	vm, ok := f.vms[id]
	if !ok {
		return fmt.Errorf("vm not found")
	}
	vm.State = "stopped"
	if b := f.logs[id]; b != nil {
		fmt.Fprintf(b, "[%s] stopped\n", time.Now().Format(time.RFC3339))
	}
	return nil
}

func (f *Firecracker) Destroy(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.vms[id]; !ok {
		return fmt.Errorf("vm not found")
	}
	delete(f.vms, id)
	delete(f.logs, id)
	return nil
}

func (f *Firecracker) Logs(_ context.Context, id string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	b, ok := f.logs[id]
	if !ok {
		return "", fmt.Errorf("vm not found")
	}
	return b.String(), nil
}
