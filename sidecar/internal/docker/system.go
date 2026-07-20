package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
)

// DiskUsageSummary is a UI-friendly view of docker system df.
type DiskUsageSummary struct {
	LayersSize       int64 `json:"layersSize"`
	ImagesSize       int64 `json:"imagesSize"`
	ImagesTotal      int   `json:"imagesTotal"`
	ImagesActive     int   `json:"imagesActive"`
	ContainersSize   int64 `json:"containersSize"`
	ContainersTotal  int   `json:"containersTotal"`
	ContainersActive int   `json:"containersActive"`
	VolumesSize      int64 `json:"volumesSize"`
	VolumesTotal     int   `json:"volumesTotal"`
	VolumesActive    int   `json:"volumesActive"`
	BuildCacheSize   int64 `json:"buildCacheSize"`
	BuildCacheTotal  int   `json:"buildCacheTotal"`
	BuildCacheActive int   `json:"buildCacheActive"`
	Reclaimable      int64 `json:"reclaimable"`
}

type PruneOptions struct {
	Containers bool `json:"containers"`
	Images     bool `json:"images"`
	Volumes    bool `json:"volumes"`
	Networks   bool `json:"networks"`
	BuildCache bool `json:"buildCache"`
}

type PruneResult struct {
	SpaceReclaimed uint64            `json:"spaceReclaimed"`
	Containers     int               `json:"containersDeleted"`
	Images         int               `json:"imagesDeleted"`
	Volumes        int               `json:"volumesDeleted"`
	Networks       int               `json:"networksDeleted"`
	BuildCaches    int               `json:"buildCachesDeleted"`
	Details        map[string]uint64 `json:"details,omitempty"`
}

func (c *Client) DiskUsage(ctx context.Context) (DiskUsageSummary, error) {
	if !c.Ready() {
		return DiskUsageSummary{}, c.err
	}
	du, err := c.cli.DiskUsage(ctx, types.DiskUsageOptions{})
	if err != nil {
		return DiskUsageSummary{}, err
	}

	sum := DiskUsageSummary{LayersSize: du.LayersSize}
	var reclaimable int64

	for _, img := range du.Images {
		if img == nil {
			continue
		}
		sum.ImagesTotal++
		sum.ImagesSize += img.Size
		if img.Containers > 0 {
			sum.ImagesActive++
		} else {
			reclaimable += img.Size
		}
	}

	for _, ctr := range du.Containers {
		if ctr == nil {
			continue
		}
		sum.ContainersTotal++
		size := ctr.SizeRw
		if size < 0 {
			size = 0
		}
		sum.ContainersSize += size
		if ctr.State == "running" {
			sum.ContainersActive++
		} else {
			reclaimable += size
		}
	}

	for _, vol := range du.Volumes {
		if vol == nil {
			continue
		}
		sum.VolumesTotal++
		var size int64
		if vol.UsageData != nil {
			size = vol.UsageData.Size
			if vol.UsageData.RefCount > 0 {
				sum.VolumesActive++
			} else {
				reclaimable += size
			}
		}
		if size > 0 {
			sum.VolumesSize += size
		}
	}

	for _, cache := range du.BuildCache {
		if cache == nil {
			continue
		}
		sum.BuildCacheTotal++
		sum.BuildCacheSize += cache.Size
		if cache.InUse {
			sum.BuildCacheActive++
		} else {
			reclaimable += cache.Size
		}
	}

	sum.Reclaimable = reclaimable
	return sum, nil
}

func (c *Client) SystemPrune(ctx context.Context, opts PruneOptions) (PruneResult, error) {
	if !c.Ready() {
		return PruneResult{}, c.err
	}
	res := PruneResult{Details: map[string]uint64{}}
	empty := filters.Args{}

	if opts.Containers {
		report, err := c.cli.ContainersPrune(ctx, empty)
		if err != nil {
			return res, err
		}
		res.Containers = len(report.ContainersDeleted)
		res.SpaceReclaimed += report.SpaceReclaimed
		res.Details["containers"] = report.SpaceReclaimed
	}
	if opts.Images {
		report, err := c.cli.ImagesPrune(ctx, empty)
		if err != nil {
			return res, err
		}
		res.Images = len(report.ImagesDeleted)
		res.SpaceReclaimed += report.SpaceReclaimed
		res.Details["images"] = report.SpaceReclaimed
	}
	if opts.Volumes {
		report, err := c.cli.VolumesPrune(ctx, empty)
		if err != nil {
			return res, err
		}
		res.Volumes = len(report.VolumesDeleted)
		res.SpaceReclaimed += report.SpaceReclaimed
		res.Details["volumes"] = report.SpaceReclaimed
	}
	if opts.Networks {
		report, err := c.cli.NetworksPrune(ctx, empty)
		if err != nil {
			return res, err
		}
		res.Networks = len(report.NetworksDeleted)
		// NetworksPrune has no SpaceReclaimed in some versions — ignore if zero
	}
	if opts.BuildCache {
		report, err := c.cli.BuildCachePrune(ctx, types.BuildCachePruneOptions{All: true})
		if err != nil {
			return res, err
		}
		if report != nil {
			res.BuildCaches = len(report.CachesDeleted)
			res.SpaceReclaimed += report.SpaceReclaimed
			res.Details["buildCache"] = report.SpaceReclaimed
		}
	}

	return res, nil
}
