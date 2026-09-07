package docker

import (
	"math"
	"testing"

	"github.com/docker/docker/api/types/container"
)

func sample() *container.StatsResponse {
	st := &container.StatsResponse{}
	st.CPUStats.CPUUsage.TotalUsage = 200
	st.PreCPUStats.CPUUsage.TotalUsage = 100
	st.CPUStats.SystemUsage = 2000
	st.PreCPUStats.SystemUsage = 1000
	st.CPUStats.OnlineCPUs = 4
	st.MemoryStats.Usage = 500
	st.MemoryStats.Limit = 1000
	return st
}

func TestStatsFromResponseCPUPercent(t *testing.T) {
	// cpuDelta 100 / systemDelta 1000 * 4 cpus * 100 = 40%
	if got := StatsFromResponse(sample()).CPUPercent; math.Abs(got-40) > 1e-9 {
		t.Errorf("CPUPercent = %v, want 40", got)
	}
}

func TestStatsFromResponseCPUFallsBackToPercpuCount(t *testing.T) {
	// Older daemons report OnlineCPUs as 0 and only fill PercpuUsage.
	st := sample()
	st.CPUStats.OnlineCPUs = 0
	st.CPUStats.CPUUsage.PercpuUsage = []uint64{1, 2}

	if got := StatsFromResponse(st).CPUPercent; math.Abs(got-20) > 1e-9 {
		t.Errorf("CPUPercent = %v, want 20 (2 cpus from PercpuUsage)", got)
	}
}

func TestStatsFromResponseCPUDefaultsToOneCPU(t *testing.T) {
	st := sample()
	st.CPUStats.OnlineCPUs = 0
	st.CPUStats.CPUUsage.PercpuUsage = nil

	if got := StatsFromResponse(st).CPUPercent; math.Abs(got-10) > 1e-9 {
		t.Errorf("CPUPercent = %v, want 10 (falls back to 1 cpu)", got)
	}
}

// A container's first sample has no previous reading, which would otherwise
// divide by zero or report a nonsense spike.
func TestStatsFromResponseCPUZeroWhenNoDelta(t *testing.T) {
	tests := []struct {
		name  string
		mutit func(*container.StatsResponse)
	}{
		{name: "no system delta", mutit: func(s *container.StatsResponse) { s.PreCPUStats.SystemUsage = s.CPUStats.SystemUsage }},
		{name: "no cpu delta", mutit: func(s *container.StatsResponse) { s.PreCPUStats.CPUUsage.TotalUsage = s.CPUStats.CPUUsage.TotalUsage }},
		{name: "first sample, all zero", mutit: func(s *container.StatsResponse) { *s = container.StatsResponse{} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			st := sample()
			tc.mutit(st)
			if got := StatsFromResponse(st).CPUPercent; got != 0 {
				t.Errorf("CPUPercent = %v, want 0", got)
			}
		})
	}
}

func TestStatsFromResponseMemoryWorkingSet(t *testing.T) {
	t.Run("cgroup v1 subtracts cache", func(t *testing.T) {
		st := sample()
		st.MemoryStats.Stats = map[string]uint64{"cache": 200}
		got := StatsFromResponse(st)
		if got.MemoryUsage != 300 {
			t.Errorf("MemoryUsage = %d, want 300 (500 - 200 cache)", got.MemoryUsage)
		}
		if math.Abs(got.MemoryPercent-30) > 1e-9 {
			t.Errorf("MemoryPercent = %v, want 30", got.MemoryPercent)
		}
	})

	t.Run("cgroup v2 subtracts inactive_file", func(t *testing.T) {
		st := sample()
		st.MemoryStats.Stats = map[string]uint64{"inactive_file": 100}
		if got := StatsFromResponse(st).MemoryUsage; got != 400 {
			t.Errorf("MemoryUsage = %d, want 400 (500 - 100 inactive_file)", got)
		}
	})

	t.Run("cache wins when both are present", func(t *testing.T) {
		st := sample()
		st.MemoryStats.Stats = map[string]uint64{"cache": 200, "inactive_file": 100}
		if got := StatsFromResponse(st).MemoryUsage; got != 300 {
			t.Errorf("MemoryUsage = %d, want 300 (cache takes precedence)", got)
		}
	})

	t.Run("cache larger than usage is ignored", func(t *testing.T) {
		// Guards the uint64 underflow that subtracting unconditionally would cause.
		st := sample()
		st.MemoryStats.Stats = map[string]uint64{"cache": 9000}
		if got := StatsFromResponse(st).MemoryUsage; got != 500 {
			t.Errorf("MemoryUsage = %d, want the raw 500, not an underflowed value", got)
		}
	})

	t.Run("no stats map uses raw usage", func(t *testing.T) {
		if got := StatsFromResponse(sample()).MemoryUsage; got != 500 {
			t.Errorf("MemoryUsage = %d, want 500", got)
		}
	})

	t.Run("zero limit yields zero percent", func(t *testing.T) {
		st := sample()
		st.MemoryStats.Limit = 0
		if got := StatsFromResponse(st).MemoryPercent; got != 0 {
			t.Errorf("MemoryPercent = %v, want 0 rather than a division by zero", got)
		}
	})
}

func TestStatsFromResponseSumsNetworksAndBlockIO(t *testing.T) {
	st := sample()
	st.Networks = map[string]container.NetworkStats{
		"eth0": {RxBytes: 100, TxBytes: 10},
		"eth1": {RxBytes: 200, TxBytes: 20},
	}
	st.BlkioStats.IoServiceBytesRecursive = []container.BlkioStatEntry{
		{Op: "Read", Value: 50},
		{Op: "read", Value: 25},
		{Op: "Write", Value: 5},
		{Op: "Async", Value: 999}, // not read or write; must be ignored
	}
	st.PidsStats.Current = 7

	got := StatsFromResponse(st)
	if got.NetRx != 300 || got.NetTx != 30 {
		t.Errorf("net = %d/%d, want 300/30 summed across interfaces", got.NetRx, got.NetTx)
	}
	if got.BlockRead != 75 {
		t.Errorf("BlockRead = %d, want 75 (case-insensitive op match)", got.BlockRead)
	}
	if got.BlockWrite != 5 {
		t.Errorf("BlockWrite = %d, want 5", got.BlockWrite)
	}
	if got.PIDs != 7 {
		t.Errorf("PIDs = %d, want 7", got.PIDs)
	}
}
