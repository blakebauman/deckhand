package docker

import (
	"bytes"
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// GPUInfo describes a host NVIDIA GPU (via nvidia-smi) and Docker runtime support.
// See https://docs.docker.com/engine/containers/gpu/
type GPUInfo struct {
	Index       int    `json:"index"`
	Name        string `json:"name"`
	UUID        string `json:"uuid"`
	MemoryUsed  uint64 `json:"memoryUsedMiB"`
	MemoryTotal uint64 `json:"memoryTotalMiB"`
	Utilization int    `json:"utilization"`
	Temperature int    `json:"temperature"`
}

type GPUStatus struct {
	Available      bool      `json:"available"`
	Runtime        string    `json:"runtime,omitempty"`
	NvidiaSmi      bool      `json:"nvidiaSmi"`
	ToolkitHint    string    `json:"toolkitHint,omitempty"`
	Devices        []GPUInfo `json:"devices"`
	Error          string    `json:"error,omitempty"`
}

func (c *Client) GPUStatus(ctx context.Context) GPUStatus {
	out := GPUStatus{
		Devices:     []GPUInfo{},
		ToolkitHint: "Install NVIDIA drivers and the NVIDIA Container Toolkit, then use docker run --gpus. See https://docs.docker.com/engine/containers/gpu/",
	}

	if c.Ready() {
		info, err := c.Info(ctx)
		if err == nil {
			if _, ok := info.Runtimes["nvidia"]; ok {
				out.Available = true
				out.Runtime = "nvidia"
			}
			// Some installs register nvidia as default via CDI / containerd
			for name := range info.Runtimes {
				if strings.Contains(strings.ToLower(name), "nvidia") {
					out.Available = true
					if out.Runtime == "" {
						out.Runtime = name
					}
				}
			}
		}
	}

	devices, err := probeNvidiaSMI(ctx)
	if err != nil {
		if !out.Available {
			out.Error = err.Error()
		}
		return out
	}
	out.NvidiaSmi = true
	out.Devices = devices
	if len(devices) > 0 {
		out.Available = true
	}
	return out
}

func probeNvidiaSMI(ctx context.Context) ([]GPUInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "nvidia-smi",
		"--query-gpu=index,name,uuid,memory.used,memory.total,utilization.gpu,temperature.gpu",
		"--format=csv,noheader,nounits",
	)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	if err := cmd.Run(); err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	out := make([]GPUInfo, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, ",")
		if len(parts) < 7 {
			continue
		}
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		idx, _ := strconv.Atoi(parts[0])
		used, _ := strconv.ParseUint(parts[3], 10, 64)
		total, _ := strconv.ParseUint(parts[4], 10, 64)
		util, _ := strconv.Atoi(parts[5])
		temp, _ := strconv.Atoi(parts[6])
		out = append(out, GPUInfo{
			Index: idx, Name: parts[1], UUID: parts[2],
			MemoryUsed: used, MemoryTotal: total,
			Utilization: util, Temperature: temp,
		})
	}
	return out, nil
}

// ContainerGPUFromInspect extracts GPU device requests from container inspect JSON-ish map/struct.
func ContainerHasGPU(deviceRequests int, devices int) bool {
	return deviceRequests > 0 || devices > 0
}
