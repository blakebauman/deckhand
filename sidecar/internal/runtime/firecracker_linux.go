//go:build linux

package runtime

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
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

type fcInstance struct {
	vm     *VM
	cmd    *exec.Cmd
	socket string
	dir    string
}

// Firecracker manages local microVMs when KVM and the firecracker binary are present.
type Firecracker struct {
	mu     sync.Mutex
	vms    map[string]*fcInstance
	logs   map[string]*strings.Builder
	bin    string
	hasKVM bool
	root   string
}

func NewFirecracker() *Firecracker {
	bin, _ := exec.LookPath("firecracker")
	_, kvmErr := os.Stat("/dev/kvm")
	home, _ := os.UserHomeDir()
	root := filepath.Join(home, ".deckhand", "firecracker")
	_ = os.MkdirAll(root, 0o755)
	return &Firecracker{
		vms:    make(map[string]*fcInstance),
		logs:   make(map[string]*strings.Builder),
		bin:    bin,
		hasKVM: kvmErr == nil,
		root:   root,
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
	for _, inst := range f.vms {
		vm := *inst.vm
		if inst.cmd != nil && inst.cmd.Process != nil {
			// still considered running if process alive
			if inst.cmd.ProcessState == nil {
				vm.State = "running"
			}
		}
		out = append(out, vm)
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

	id := newID()
	dir := filepath.Join(f.root, id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	vm := &VM{
		ID:     id,
		Name:   req.Name,
		State:  "created",
		VCPU:   req.VCPU,
		Memory: req.Memory,
		Kernel: filepath.Clean(req.Kernel),
		Rootfs: filepath.Clean(req.Rootfs),
	}
	f.mu.Lock()
	f.vms[id] = &fcInstance{vm: vm, socket: filepath.Join(dir, "firecracker.sock"), dir: dir}
	f.logs[id] = &strings.Builder{}
	fmt.Fprintf(f.logs[id], "[%s] created vm %s kernel=%s rootfs=%s\n", time.Now().Format(time.RFC3339), vm.Name, vm.Kernel, vm.Rootfs)
	f.mu.Unlock()
	return vm, nil
}

func (f *Firecracker) Start(ctx context.Context, id string) error {
	f.mu.Lock()
	inst, ok := f.vms[id]
	if !ok {
		f.mu.Unlock()
		return fmt.Errorf("vm not found")
	}
	if inst.cmd != nil && inst.cmd.Process != nil && inst.cmd.ProcessState == nil {
		f.mu.Unlock()
		return fmt.Errorf("vm already running")
	}
	socket := inst.socket
	_ = os.Remove(socket)
	cmd := exec.Command(f.bin, "--api-sock", socket)
	cmd.Dir = inst.dir
	logPath := filepath.Join(inst.dir, "firecracker.log")
	logFile, err := os.Create(logPath)
	if err != nil {
		f.mu.Unlock()
		return err
	}
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	if err := cmd.Start(); err != nil {
		logFile.Close()
		f.mu.Unlock()
		return fmt.Errorf("start firecracker: %w", err)
	}
	inst.cmd = cmd
	inst.vm.State = "starting"
	if b := f.logs[id]; b != nil {
		fmt.Fprintf(b, "[%s] process started pid=%d sock=%s\n", time.Now().Format(time.RFC3339), cmd.Process.Pid, socket)
	}
	kernel := inst.vm.Kernel
	rootfs := inst.vm.Rootfs
	vcpu := inst.vm.VCPU
	mem := inst.vm.Memory
	f.mu.Unlock()

	if err := waitUnix(socket, 5*time.Second); err != nil {
		_ = cmd.Process.Kill()
		return fmt.Errorf("api sock: %w", err)
	}
	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", socket)
			},
		},
		Timeout: 10 * time.Second,
	}
	if err := fcPut(client, "http://localhost/machine-config", map[string]any{
		"vcpu_count":   vcpu,
		"mem_size_mib": mem,
	}); err != nil {
		_ = f.Stop(ctx, id)
		return fmt.Errorf("machine-config: %w", err)
	}
	if err := fcPut(client, "http://localhost/boot-source", map[string]any{
		"kernel_image_path": kernel,
		"boot_args":         "console=ttyS0 reboot=k panic=1 pci=off",
	}); err != nil {
		_ = f.Stop(ctx, id)
		return fmt.Errorf("boot-source: %w", err)
	}
	if err := fcPut(client, "http://localhost/drives/rootfs", map[string]any{
		"drive_id":       "rootfs",
		"path_on_host":   rootfs,
		"is_root_device": true,
		"is_read_only":   false,
	}); err != nil {
		_ = f.Stop(ctx, id)
		return fmt.Errorf("drives: %w", err)
	}
	if err := fcPut(client, "http://localhost/actions", map[string]any{
		"action_type": "InstanceStart",
	}); err != nil {
		_ = f.Stop(ctx, id)
		return fmt.Errorf("InstanceStart: %w", err)
	}

	f.mu.Lock()
	if inst, ok := f.vms[id]; ok {
		inst.vm.State = "running"
		if b := f.logs[id]; b != nil {
			fmt.Fprintf(b, "[%s] InstanceStart ok\n", time.Now().Format(time.RFC3339))
		}
	}
	f.mu.Unlock()
	go func() {
		_ = cmd.Wait()
		logFile.Close()
		f.mu.Lock()
		if inst, ok := f.vms[id]; ok && inst.cmd == cmd {
			inst.vm.State = "stopped"
			if b := f.logs[id]; b != nil {
				fmt.Fprintf(b, "[%s] process exited\n", time.Now().Format(time.RFC3339))
			}
		}
		f.mu.Unlock()
	}()
	return nil
}

func (f *Firecracker) Stop(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	inst, ok := f.vms[id]
	if !ok {
		return fmt.Errorf("vm not found")
	}
	if inst.cmd != nil && inst.cmd.Process != nil && inst.cmd.ProcessState == nil {
		_ = inst.cmd.Process.Signal(os.Interrupt)
		done := make(chan struct{})
		go func() {
			_ = inst.cmd.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			_ = inst.cmd.Process.Kill()
		}
	}
	inst.cmd = nil
	inst.vm.State = "stopped"
	if b := f.logs[id]; b != nil {
		fmt.Fprintf(b, "[%s] stopped\n", time.Now().Format(time.RFC3339))
	}
	return nil
}

func (f *Firecracker) Destroy(ctx context.Context, id string) error {
	_ = f.Stop(ctx, id)
	f.mu.Lock()
	defer f.mu.Unlock()
	inst, ok := f.vms[id]
	if !ok {
		return fmt.Errorf("vm not found")
	}
	if inst.dir != "" {
		_ = os.RemoveAll(inst.dir)
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
	out := b.String()
	if inst, ok := f.vms[id]; ok {
		if raw, err := os.ReadFile(filepath.Join(inst.dir, "firecracker.log")); err == nil {
			out += "\n--- firecracker.log ---\n" + string(raw)
		}
	}
	return out, nil
}

func waitUnix(path string, d time.Duration) error {
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(path); err == nil {
			conn, err := net.DialTimeout("unix", path, 200*time.Millisecond)
			if err == nil {
				_ = conn.Close()
				return nil
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for %s", path)
}

func fcPut(client *http.Client, url string, body any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		var buf bytes.Buffer
		_, _ = buf.ReadFrom(res.Body)
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, buf.String())
	}
	return nil
}
