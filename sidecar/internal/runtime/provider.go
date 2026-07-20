package runtime

import "context"

// Provider abstracts microVM / alternate compute runtimes (Firecracker on Linux).
type Provider interface {
	Name() string
	Available(ctx context.Context) bool
	List(ctx context.Context) ([]VM, error)
	Create(ctx context.Context, req CreateRequest) (*VM, error)
	Start(ctx context.Context, id string) error
	Stop(ctx context.Context, id string) error
	Destroy(ctx context.Context, id string) error
	// Logs returns recent console/log lines for a VM (best-effort).
	Logs(ctx context.Context, id string) (string, error)
}

type VM struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	State  string `json:"state"`
	VCPU   int    `json:"vcpu"`
	Memory int    `json:"memoryMb"`
	Kernel string `json:"kernel,omitempty"`
	Rootfs string `json:"rootfs,omitempty"`
}

type CreateRequest struct {
	Name   string `json:"name"`
	Kernel string `json:"kernel"`
	Rootfs string `json:"rootfs"`
	VCPU   int    `json:"vcpu"`
	Memory int    `json:"memoryMb"`
}

// Registry holds registered runtime providers.
type Registry struct {
	providers []Provider
}

func NewRegistry(providers ...Provider) *Registry {
	return &Registry{providers: providers}
}

func (r *Registry) All() []Provider {
	return r.providers
}

func (r *Registry) Get(name string) Provider {
	for _, p := range r.providers {
		if p.Name() == name {
			return p
		}
	}
	return nil
}
