package docker

import (
	"context"
	"encoding/json"
	"io"
	"strings"

	"github.com/docker/docker/api/types/container"
)

func (c *Client) ContainerStats(ctx context.Context, id string, stream bool) (io.ReadCloser, error) {
	if !c.Ready() {
		return nil, c.err
	}
	resp, err := c.cli.ContainerStats(ctx, id, stream)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

// StatsSample mirrors docker stats columns: CPU %, MEM, NET I/O, BLOCK I/O.
// See https://docs.docker.com/engine/containers/runmetrics/
type StatsSample struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsage   uint64  `json:"memoryUsage"`
	MemoryLimit   uint64  `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetRx         uint64  `json:"netRx"`
	NetTx         uint64  `json:"netTx"`
	BlockRead     uint64  `json:"blockRead"`
	BlockWrite    uint64  `json:"blockWrite"`
	PIDs          uint64  `json:"pids"`
}

func DecodeOneStats(r io.Reader) (*StatsSample, error) {
	var st container.StatsResponse
	if err := json.NewDecoder(r).Decode(&st); err != nil {
		return nil, err
	}
	return StatsFromResponse(&st), nil
}

// StreamStats decodes the Docker stats stream and calls fn for each sample.
func StreamStats(r io.Reader, fn func(*StatsSample) error) error {
	dec := json.NewDecoder(r)
	for {
		var st container.StatsResponse
		if err := dec.Decode(&st); err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if err := fn(StatsFromResponse(&st)); err != nil {
			return err
		}
	}
}

func StatsFromResponse(st *container.StatsResponse) *StatsSample {
	cpuDelta := float64(st.CPUStats.CPUUsage.TotalUsage - st.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(st.CPUStats.SystemUsage - st.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	if systemDelta > 0 && cpuDelta > 0 {
		online := float64(st.CPUStats.OnlineCPUs)
		if online == 0 {
			online = float64(len(st.CPUStats.CPUUsage.PercpuUsage))
		}
		if online == 0 {
			online = 1
		}
		cpuPercent = (cpuDelta / systemDelta) * online * 100.0
	}

	mem := st.MemoryStats.Usage
	// Prefer working set when cache is available (cgroup v1 style).
	if st.MemoryStats.Stats != nil {
		if cache, ok := st.MemoryStats.Stats["cache"]; ok && mem > cache {
			mem = mem - cache
		} else if inactive, ok := st.MemoryStats.Stats["inactive_file"]; ok && mem > inactive {
			// cgroup v2 approximation used by docker CLI
			mem = mem - inactive
		}
	}
	limit := st.MemoryStats.Limit
	memPct := 0.0
	if limit > 0 {
		memPct = float64(mem) / float64(limit) * 100.0
	}

	var netRx, netTx uint64
	for _, n := range st.Networks {
		netRx += n.RxBytes
		netTx += n.TxBytes
	}

	var blockRead, blockWrite uint64
	for _, entry := range st.BlkioStats.IoServiceBytesRecursive {
		switch strings.ToLower(entry.Op) {
		case "read":
			blockRead += entry.Value
		case "write":
			blockWrite += entry.Value
		}
	}

	return &StatsSample{
		CPUPercent:    cpuPercent,
		MemoryUsage:   mem,
		MemoryLimit:   limit,
		MemoryPercent: memPct,
		NetRx:         netRx,
		NetTx:         netTx,
		BlockRead:     blockRead,
		BlockWrite:    blockWrite,
		PIDs:          st.PidsStats.Current,
	}
}
